import { NextResponse } from 'next/server';
import { supabase } from '@/db';
import { waitUntil } from '@vercel/functions';
import { saveMemory, saveDocument, getMemoryContext, canStoreMemory, getSemanticHistory } from '@/lib/memory-service';
import { reminderTask } from '@/trigger/reminder';
import { SpeechClient } from '@google-cloud/speech';
import { generateText, stepCountIs } from 'ai';
import { getModel } from '@/lib/ai-provider';
import { getWhatsAppSystemPrompt } from '@/lib/system-prompts';
import { createLogger } from '@/lib/logger';
import { retryAsync } from '@/lib/retry';
import { enviarAvisoWhatsApp, enviarSticker, enviarImagemWhatsApp, markAsReading, downloadMedia } from '@/lib/evolution-client';
import { renderChartToBase64 } from '@/lib/chart-renderer';
import {
    searchProjects, getCalendarEvents, createProject,
    getProjectDetails, getDRMData, analyzeProjects, searchDocuments, searchNotion,
    createMemoryTool, searchMemoriesTool, deleteMemoryTool,
    listRemindersTool, cancelReminderTool, updateProjectStatusTool
} from '@/app/api/chat/tools';

const logger = createLogger('evolution');

// ─── Processamento de PDF ─────────────────────────────────────────────────────

async function processPdf(phone: string, messageKey: any, messageData: any, filename: string) {
  logger.info(` 📨 PDF recebido de ${phone}: "${filename}"`);
  await enviarAvisoWhatsApp(phone, `📄 Recebi o PDF *${filename}*! Processando... aguarda um momento.`);

  const allowed = await canStoreMemory(phone);
  if (!allowed) {
    logger.warn(` ⛔ Sem permissão para salvar: ${phone}`);
    await enviarAvisoWhatsApp(phone, '❌ Você não tem permissão para salvar documentos na minha memória.');
    return;
  }

  logger.info(` ⬇️  Baixando mídia...`);
  const buffer = await downloadMedia(messageKey, messageData);
  if (!buffer) {
    logger.error(` ❌ Falha ao baixar mídia de ${phone}`);
    await enviarAvisoWhatsApp(phone, '❌ Não consegui baixar o PDF. Tente novamente.');
    return;
  }
  logger.info(` ✅ Mídia baixada: ${(buffer.length / 1024).toFixed(1)} KB`);

  try {
    const docId = await saveDocument(buffer, filename, phone);
    logger.info(` 🎉 Processo concluído! docId=${docId}`);

    // Guarda estado pendente para aguardar o assunto do usuário
    await supabase.from('chats').insert({
      phone,
      role: 'pending',
      content: JSON.stringify({ action: 'awaiting_pdf_title', document_id: docId }),
      created_at: Date.now(),
    });

    await enviarAvisoWhatsApp(phone, `✅ PDF processado! Qual o *assunto* deste documento? (isso me ajuda a organizá-lo melhor)`);
  } catch (e: any) {
    logger.error(` ❌ Erro ao processar "${filename}":`, e);
    await enviarAvisoWhatsApp(phone, `❌ Erro ao processar o PDF: ${e.message}`);
  }
}

// ─── Processamento de áudio (STT via Google Cloud Speech) ─────────────────

function getSpeechClient() {
  const b64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (b64) {
    const credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return new SpeechClient({ credentials });
  }
  // fallback local
  return new SpeechClient({ keyFilename: 'google-credentials.json' });
}

async function transcribeAudio(buffer: Buffer, mimetype: string): Promise<string> {
  let encoding: 'OGG_OPUS' | 'MP3' | 'WEBM_OPUS' | 'LINEAR16' = 'OGG_OPUS';
  if (mimetype?.includes('mp3') || mimetype?.includes('mpeg')) encoding = 'MP3';
  else if (mimetype?.includes('webm')) encoding = 'WEBM_OPUS';
  else if (mimetype?.includes('wav')) encoding = 'LINEAR16';

  logger.info(`Transcrevendo ${(buffer.length / 1024).toFixed(1)} KB via Google Speech (${encoding})`);

  const [response] = await retryAsync(
    () => getSpeechClient().recognize({
      audio: { content: buffer.toString('base64') },
      config: {
        encoding,
        sampleRateHertz: 16000,
        languageCode: 'pt-BR',
        alternativeLanguageCodes: ['en-US'],
        model: 'latest_long',
        enableAutomaticPunctuation: true,
      },
    }),
    { attempts: 3, delayMs: 500, onRetry: (attempt, err) => logger.warn(`STT tentativa ${attempt} falhou`, err) }
  );

  const text = response.results
    ?.map(r => r.alternatives?.[0]?.transcript)
    .filter(Boolean)
    .join(' ') || '';

  logger.info(`STT resultado: "${text.slice(0, 100)}"`);
  return text;
}

async function inferSubjectFromText(text: string): Promise<string> {
  try {
    const result = await generateText({
      model: getModel(),
      system: 'Gere um titulo curto (3-5 palavras) em portugues para o seguinte conteudo. Responda APENAS com o titulo, sem pontuacao.',
      messages: [{ role: 'user', content: text.slice(0, 500) }],
    });
    return result.text?.trim() || 'Audio';
  } catch {
    return 'Audio';
  }
}

async function processAudio(phone: string, messageKey: Record<string, unknown>, messageData: Record<string, unknown>, mimetype: string) {
  logger.info(` Audio recebido de ${phone}`);
  await markAsReading(phone);

  const buffer = await downloadMedia(messageKey, messageData);
  if (!buffer) {
    logger.error(` Falha ao baixar audio de ${phone}`);
    await enviarAvisoWhatsApp(phone, '❌ Não consegui baixar o áudio. Tente novamente.');
    return;
  }

  try {
    const text = await transcribeAudio(buffer, mimetype);
    if (!text) {
      await enviarAvisoWhatsApp(phone, '❌ Não consegui entender o áudio. Pode tentar de novo?');
      return;
    }

    // Processa como mensagem normal, indicando origem de audio
    await processMessage(phone, text, 'audio');
  } catch (e) {
    console.error('[Audio] Erro na transcricao:', e);
    await enviarAvisoWhatsApp(phone, '❌ Erro ao processar o áudio. Tente novamente.');
  }
}

// ─── Parser de lembretes via LLM ──────────────────────────────────────────────

const REMINDER_REGEX = /me\s+lemb(?:re|ra|rar|retes?)\s*(?:d[ae]?\s+)?|lembrete[:\s]+|me\s+avis[ae]\s*(?:d[ae]\s+)?|n(?:ao|ão)\s+(?:me\s+)?(?:deixa|deixe)\s+(?:eu\s+)?esquecer|lembr(?:a|e|ar)\s+d[ae]\s+|quero\s+(?:um\s+)?lembrete/i;

export async function parseReminder(text: string): Promise<{ what: string; when: Date } | null> {
  // Passa o timestamp Unix atual para o LLM evitar ambiguidade de timezone
  const nowUtcMs = Date.now();
  const nowBRT = new Date(nowUtcMs).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' });

  try {
    const result = await generateText({
      model: getModel(),
      system: `Extraia o lembrete da mensagem. Data/hora atual em Brasilia (UTC-3): ${nowBRT} (Unix timestamp: ${nowUtcMs}ms).
Retorne um JSON com:
- "what": o que deve ser lembrado (texto limpo, sem "me lembre de", etc.)
- "whenMs": timestamp Unix em milliseconds do momento em que o lembrete deve disparar

Regras:
- Se nao houver data/hora especificada, retorne null em "whenMs"
- Interprete "amanha", "proxima semana", "daqui a X minutos/horas" corretamente usando o Unix timestamp fornecido
- "daqui a 2 minutos" = ${nowUtcMs} + 120000
- Sempre retorne "whenMs" como numero inteiro

Responda APENAS com JSON valido, sem markdown.`,
      messages: [{ role: 'user', content: text }],
    });

    const raw = (result.text || '').replace(/```json\n?|```/g, '').trim();
    console.log('[parseReminder] LLM raw:', raw);
    const parsed = JSON.parse(raw || '{}');

    if (!parsed.what?.trim() || !parsed.whenMs) return null;

    const when = new Date(Number(parsed.whenMs));
    console.log('[parseReminder] when:', when.toISOString(), 'now:', new Date().toISOString(), 'diff:', when.getTime() - Date.now(), 'ms');
    if (isNaN(when.getTime()) || when.getTime() <= Date.now()) return null;

    return { what: parsed.what, when };
  } catch {
    return null;
  }
}

// ─── Processamento de mensagem normal ─────────────────────────────────────────

async function processMessage(phone: string, text: string, source: 'text' | 'audio' = 'text', senderPhone?: string) {
  try {
    await markAsReading(phone);

    // ── Verifica acao pendente (aguardando titulo de PDF ou memoria) ──────────
    const { data: pendingRow } = await supabase
      .from('chats')
      .select('content')
      .eq('phone', phone)
      .eq('role', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingRow) {
      const pending = JSON.parse(pendingRow.content as string);

      if (pending.action === 'awaiting_pdf_title') {
        const title = text.trim();
        await supabase.from('documents').update({ description: title }).eq('id', pending.document_id);
        await supabase.from('document_chunks').update({ document_title: title }).eq('document_id', pending.document_id);
        await supabase.from('chats').delete().eq('phone', phone).eq('role', 'pending');
        await enviarAvisoWhatsApp(phone, `✅ Titulo definido: *${title}*. Documento pronto para consulta!`);
        return;
      }

      if (pending.action === 'awaiting_memory_title') {
        const title = text.trim();
        await saveMemory(`[${title}] ${pending.content}`, phone, 'message');
        await supabase.from('chats').delete().eq('phone', phone).eq('role', 'pending');
        await enviarAvisoWhatsApp(phone, `✅ Memorizado com titulo: *${title}*`);
        return;
      }
    }

    // ── Intent de lembrete ────────────────────────────────────────────────────
    if (REMINDER_REGEX.test(text)) {
      const parsed = await parseReminder(text);
      if (parsed) {
        const isGroup = phone.includes('@g.us');
        const resolvedSenderPhone = senderPhone || phone.replace(/@.+/, '').replace(/\D/g, '');

        const reminderPayload = { senderPhone: resolvedSenderPhone, jid: phone, isGroup, reminder: parsed.what.trim() };
        console.log('[Reminder] Triggering with payload:', JSON.stringify(reminderPayload), 'at:', parsed.when.toISOString());
        const run = await reminderTask.trigger(reminderPayload, { delay: parsed.when });
        console.log('[Reminder] Run criado:', run.id);

        const whenStr = parsed.when.toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        await enviarAvisoWhatsApp(phone, `⏰ Lembrete criado!\n\n*${parsed.what}*\n\n📅 Vou te avisar ${whenStr}.`);
        return;
      }
      // Se nao conseguiu parsear data/hora, cai no LLM para responder
    }

    // ── Intent de salvar memoria ──────────────────────────────────────────────
    const saveTrigger = /salva\s+isso[:\s]+(.+)/i.exec(text);
    if (saveTrigger) {
      const allowed = await canStoreMemory(phone);
      if (!allowed) {
        await enviarAvisoWhatsApp(phone, '❌ Você não tem permissão para salvar memórias.');
        return;
      }
      const content = saveTrigger[1].trim();

      if (source === 'audio') {
        // Audio: infere o assunto automaticamente
        const subject = await inferSubjectFromText(content);
        await saveMemory(`[${subject}] ${content}`, phone, 'message');
        await enviarAvisoWhatsApp(phone, `✅ Memorizado com titulo inferido: *${subject}*`);
      } else {
        // Texto/grupo: pede titulo antes de salvar
        await supabase.from('chats').insert({
          phone,
          role: 'pending',
          content: JSON.stringify({ action: 'awaiting_memory_title', content }),
          created_at: Date.now(),
        });
        await enviarAvisoWhatsApp(phone, `📝 Entendido! Qual o *titulo* para essa memoria?`);
      }
      return;
    }

    // Salva mensagem do usuário no histórico
    await supabase.from('chats').insert({ phone, role: 'user', content: text, created_at: Date.now() });

    // Busca histórico semântico (top 10 de 30, ponderado por recência + relevância)
    const messages = await getSemanticHistory(text, phone, 10);

    // Busca contexto de memória isolado por owner (phone do usuário ou JID do grupo)
    const memoryContext = await getMemoryContext(text, phone);

    const isAllowedToSaveMemory = await canStoreMemory(phone);

    // ── LLM com tools (o modelo decide qual ferramenta chamar) ─────────────
    const result = await generateText({
      model: getModel(),
      system: getWhatsAppSystemPrompt(memoryContext),
      messages,
      tools: {
        searchProjects,
        searchNotion,
        getCalendarEvents,
        createProject,
        getProjectDetails,
        getDRMData,
        analyzeProjects,
        searchDocuments,
        saveMemory: createMemoryTool(phone, isAllowedToSaveMemory),
        searchMemories: searchMemoriesTool(phone),
        deleteMemory: deleteMemoryTool(phone, isAllowedToSaveMemory),
        listReminders: listRemindersTool(phone),
        cancelReminder: cancelReminderTool(phone),
        updateProjectStatus: updateProjectStatusTool,
      },
      stopWhen: stepCountIs(5),
    });

    const assistantContent = result.text || "Desculpe, tive um problema ao processar sua resposta.";

    // Verifica se algum step chamou analyzeProjects e retornou dados de gráfico
    let chartData: any = null;
    const steps = await Promise.resolve(result.steps ?? []);
    logger.info(`[Chart] steps count: ${steps.length}`);
    for (const step of steps) {
      const toolResults = (step as any).toolResults ?? [];
      logger.info(`[Chart] step toolResults count: ${toolResults.length}`);
      for (const tr of toolResults) {
        logger.info(`[Chart] toolResult: name=${tr.toolName} output keys=${Object.keys(tr.output ?? {}).join(',')}`);
        if (tr.toolName === 'analyzeProjects' && tr.output?.type) {
          chartData = tr.output;
          break;
        }
      }
      if (chartData) break;
    }
    logger.info(`[Chart] chartData found: ${!!chartData}`);

    await supabase.from('chats').insert({ phone, role: 'assistant', content: assistantContent, created_at: Date.now() });

    if (chartData) {
      logger.info(`[Chart] rendering chart type=${chartData.type}`);
      const imageBase64 = await renderChartToBase64(chartData);
      logger.info(`[Chart] render result: ${imageBase64 ? `ok (${imageBase64.length} chars)` : 'null'}`);
      if (imageBase64) {
        await enviarImagemWhatsApp(phone, imageBase64, assistantContent);
      } else {
        await enviarAvisoWhatsApp(phone, assistantContent);
      }
    } else {
      await enviarAvisoWhatsApp(phone, assistantContent);
    }

  } catch (error) {
    console.error('[Evolution Process] Error:', error);
    await enviarAvisoWhatsApp(phone, "Desculpe, ocorreu um erro interno. Tente novamente em instantes.");
  }
}


// ─── Whitelist (DB + fallback JSON) ──────────────────────────────────────────

import fs from 'fs';
import path from 'path';

// ─── Bone emoji easter egg ────────────────────────────────────────────────────

async function handleStickerEmoji(phone: string, stickerFile: string, mensagem: string): Promise<void> {
  const stickerPath = path.join(process.cwd(), 'public', 'stickers', stickerFile);

  if (fs.existsSync(stickerPath)) {
    const stickerBase64 = fs.readFileSync(stickerPath).toString('base64');
    await enviarSticker(phone, stickerBase64);
  } else {
    logger.warn(` Sticker não encontrado: ${stickerPath}`);
  }

  await enviarAvisoWhatsApp(phone, mensagem);
}

function getPermissionsFromJson() {
  try {
    const filePath = path.join(process.cwd(), 'jarvis-permissions.json');
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return { users: {}, groups: {} };
  }
}

export async function checkAuthorization(phone: string, isGroup: boolean, groupJid: string | null): Promise<boolean> {
  // Grupos: usa apenas o JSON (grupos não têm phone individual)
  if (isGroup && groupJid) {
    const perms = getPermissionsFromJson();
    return !!Object.values(perms.groups || {}).find((g: any) => g.jid === groupJid);
  }

  // Usuários individuais: tenta DB primeiro (com timeout), fallback para JSON
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    const dbEntry = await Promise.race([
      supabase.from('whitelist').select('active').eq('phone', cleanPhone).maybeSingle(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 3000))
    ]);
    if (dbEntry?.data != null) return !!dbEntry.data.active;
  } catch (e: any) {
    // DB indisponível ou lento → usa JSON como fallback
    if (e?.message !== 'DB timeout') logger.warn(' DB erro:', e?.message);
    else logger.warn(' DB timeout → usando fallback JSON');
  }

  const perms = getPermissionsFromJson();
  return !!Object.entries(perms.users || {}).find(([k]) => {
    const userK = k.replace(/\D/g, '');
    const inPhone = phone.replace(/\D/g, '');
    // Regex estrito para garantir que eh um formato valido e evitar matches acidentais
    if (!/^\d{10,15}$/.test(inPhone)) return false;
    return inPhone.includes(userK) && Math.abs(inPhone.length - userK.length) <= 2; // Validação mais estrita, aceitando DDI/DDD
  });
}

// ─── Deduplicação e Rate Limit em Memoria (Serverless) ─────────────
const processedMessageIds = new Set<string>();
const userRateLimits = new Map<string, number[]>();

function checkRateLimit(key: string, limit = 10): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 min window

  let times = userRateLimits.get(key) || [];
  times = times.filter(t => now - t < windowMs);

  if (times.length >= limit) return false;

  times.push(now);
  userRateLimits.set(key, times);
  return true;
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const event = payload.event;

    if (event !== 'messages.upsert') return NextResponse.json({ status: 'ignored' });

    const msgData = payload.data?.message;
    const key = payload.data?.key;

    console.log("[Evolution Webhook Payload]:", JSON.stringify(payload.data, null, 2));

    if (key?.fromMe || key?.remoteJid?.includes('status@broadcast')) {
      return NextResponse.json({ status: 'ignored' });
    }

    const msgId = msgData?.key?.id || payload.data?.key?.id;

    // W1: Deduplicação de mensagens em memória (evita duplicidade em Vercel retries simultâneos)
    if (msgId) {
      if (processedMessageIds.has(msgId)) return NextResponse.json({ status: 'ignored_duplicate' });
      processedMessageIds.add(msgId);
      if (processedMessageIds.size > 2000) {
        const iter = processedMessageIds.values();
        for (let i = 0; i < 500; i++) processedMessageIds.delete(iter.next().value!);
      }
    }

    const phone = key?.remoteJidAlt || key?.remoteJid;
    const isGroup = phone?.includes('@g.us');
    // Em grupos, o remetente vem em payload.data.participant; em chats individuais é o próprio phone
    const senderPhone: string = isGroup
      ? (payload.data?.participant || '').replace(/@.+/, '').replace(/\D/g, '')
      : (phone || '').replace(/@.+/, '').replace(/\D/g, '');
    const mentionedJid = [
      ...(msgData?.extendedTextMessage?.contextInfo?.mentionedJid || []),
      ...(payload.data?.contextInfo?.mentionedJid || []),
    ];
    const botIdentifier = process.env.EVOLUTION_BOT_NUMBER || '5511949633602';
    const botLid = process.env.EVOLUTION_BOT_LID || '';

    // ── PDF recebido ───────────────────────────────────────────────────────────
    const docMsg = msgData?.documentMessage;
    if (phone && docMsg?.mimetype === 'application/pdf') {
      const filename = docMsg.fileName || 'documento.pdf';
      const authorized = await checkAuthorization(phone, isGroup, isGroup ? phone : null);

      if (!authorized) {
        logger.info(` Número não autorizado: ${phone}`);
        return NextResponse.json({ status: 'unauthorized' });
      }

      if (Number(docMsg.fileLength) > 25 * 1024 * 1024) {
        waitUntil(enviarAvisoWhatsApp(phone, '❌ O PDF enviado tem mais de 25MB e excede nosso limite atual. Por favor, envie um arquivo menor.'));
        return NextResponse.json({ status: 'ignored_too_large' });
      }

      waitUntil(processPdf(phone, key, msgData, filename));
      return NextResponse.json({ success: true });
    }

    // ── Áudio recebido (nota de voz ou arquivo de áudio) ──────────────────────
    const audioMsg = msgData?.audioMessage || msgData?.pttMessage;
    if (phone && audioMsg) {
      const authorized = await checkAuthorization(phone, isGroup, isGroup ? phone : null);
      if (!authorized) {
        logger.info(` Número não autorizado: ${phone}`);
        return NextResponse.json({ status: 'unauthorized' });
      }

      const mimetype = audioMsg.mimetype || 'audio/ogg; codecs=opus';
      const isVercel = process.env.VERCEL === '1';
      if (isVercel) {
        waitUntil(processAudio(phone, key, msgData, mimetype));
      } else {
        processAudio(phone, key, msgData, mimetype).catch(e => logger.error(' Error:', e));
      }
      return NextResponse.json({ success: true });
    }

    // ── Mensagem de texto ──────────────────────────────────────────────────────
    const text = msgData?.conversation || msgData?.extendedTextMessage?.text;

    if (!phone || !text) return NextResponse.json({ status: 'ignored' });

    let authorized = false;

    if (isGroup) {
      logger.info(`[Evolution Group Check] JID chegou: ${phone}`);
      const perms = getPermissionsFromJson();
      const groupAuth = Object.values(perms.groups || {}).find((g: any) => g.jid === phone);

      if (!groupAuth) {
        logger.info(`[Evolution Group Check] ❌ Grupo bloqueado: ${phone}`);
        return NextResponse.json({ status: 'unauthorized_group' });
      }

      const textLower = text.toLowerCase();
      const isMentioned = mentionedJid.some((jid: string) => jid.includes(botIdentifier) || (botLid && jid.includes(botLid)))
        || textLower.includes('@jarvis')
        || textLower.includes('@ninjasearch')
        || textLower.includes('@ninja');

      if (!isMentioned) {
        return NextResponse.json({ status: 'ignored_not_mentioned_in_group' });
      }

      authorized = true;
    } else {
      authorized = await checkAuthorization(phone, false, null);
      if (!authorized) {
        logger.info(`[Evolution User Check] ❌ Número não autorizado: ${phone}`);
        return NextResponse.json({ status: 'unauthorized_number' });
      }
    }

    if (authorized) {
      // W2: Rate limiting — grupos: 30/min, direto: 10/min
      const rateLimitKey = isGroup ? phone : phone;
      const rateLimitMax = isGroup ? 30 : 10;
      if (!checkRateLimit(rateLimitKey, rateLimitMax)) {
        logger.warn(`Rate limit atingido para ${isGroup ? 'grupo' : 'usuário'}: ${phone}`);
        if (!isGroup) {
          waitUntil(enviarAvisoWhatsApp(phone, '⏳ Você está enviando mensagens rápido demais. Por favor, aguarde um minuto e tente novamente.'));
        }
        return NextResponse.json({ status: 'rate_limited' });
      }

      // W7: Limpeza automática do histórico de chat (mantém < 30 dias)
      waitUntil((async () => {
        await supabase.from('chats').delete().lt('created_at', Date.now() - 30 * 24 * 60 * 60 * 1000);
      })());

      // Remove menções (@Jarvis, @ninja, etc.) para checar easter eggs em grupos
      const cleanText = text.replace(/@\S+/g, '').trim();

      // W4: Comando de Ajuda
      if (cleanText.toLowerCase() === '/ajuda') {
        const helpText = `*🤖 Jarvis — Interface de Ajuda*\n\n` +
          `Aqui estão alguns dos comandos que você pode usar:\n` +
          `• \`salva isso: [texto]\` — Salva a informação na minha memória permanente.\n` +
          `• \`me lembra de [tarefa] amanhã às 15h\` — Crio um lembrete para você.\n` +
          `• \`quando é minha reunião?\` — Checo a sua agenda via Microsoft Graph.\n` +
          `• \`projetos atrasados\` — Listo projetos no Notion e mostro indicadores.\n` +
          `• \`/ajuda\` — Mostra esta mensagem.\n\n` +
          `Você também pode me enviar um arquivo PDF para eu indexar todo o texto dele!`;
          
        waitUntil(enviarAvisoWhatsApp(phone, helpText));
        return NextResponse.json({ success: true });
      }

      // ── Easter eggs ───────────────────────────────────────────────────────
      if (cleanText === '🦴') {
        waitUntil(handleStickerEmoji(phone, 'rex-dog.webp', 'Au au! 🐾❤️'));
        return NextResponse.json({ success: true });
      }
      if (cleanText === '🐱' || cleanText === '🐈' || cleanText === '😺') {
        waitUntil(handleStickerEmoji(phone, 'rex-cat.webp', 'Errrrrh..'));
        return NextResponse.json({ success: true });
      }

      const isVercel = process.env.VERCEL === '1';
      if (isVercel) {
        waitUntil(processMessage(phone, text, 'text', senderPhone));
      } else {
        processMessage(phone, text, 'text', senderPhone).catch(e => logger.error(' Error:', e));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" Parse Error:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
