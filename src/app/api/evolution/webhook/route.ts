import { NextResponse } from 'next/server';
import { supabase } from '@/db';
import { waitUntil } from '@vercel/functions';
import { saveMemory, saveDocument, getMemoryContext, canStoreMemory, getSemanticHistory, getUserName } from '@/lib/memory-service';
import { reminderTask } from '@/trigger/reminder';
import { SpeechClient } from '@google-cloud/speech';
import { generateText, stepCountIs } from 'ai';
import { getModel } from '@/lib/ai-provider';
import { getWhatsAppSystemPrompt } from '@/lib/system-prompts';
import { createLogger } from '@/lib/logger';
import { retryAsync } from '@/lib/retry';
import { enviarAvisoWhatsApp, enviarSticker, enviarImagemWhatsApp, markAsReading, downloadMedia, enviarListaWhatsApp } from '@/lib/evolution-client';
import { GraphCalendarAdapter } from '@jarvis/adapters/src/ms-graph';
import { renderChartToBase64 } from '@/lib/chart-renderer';
import {
    searchProjects, getCalendarEvents, createProject,
    getProjectDetails, getDRMData, analyzeProjects, createRenderChartTool, searchDocuments, searchNotion,
    createMemoryTool, searchMemoriesTool, deleteMemoryTool,
    listRemindersTool, cancelReminderTool, updateProjectStatusTool, createWhatsAppReminderTool,
    createListarEmailsRemetenteTool,
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

const BOT_MENTION_REGEX = /\bjarvis\b|\bninja\s*search\b|\bninja\b/i;
const TRANSCRIPT_REQUEST_REGEX = /transcreve|transcrição|transcript|escreve\s+o\s+que|o\s+que\s+(ele|ela|a\s+pessoa)\s+(disse|falou|fala)|passar\s+para\s+texto|texto\s+do\s+áudio/i;

async function processAudio(
  phone: string,
  messageKey: Record<string, unknown>,
  messageData: Record<string, unknown>,
  mimetype: string,
  options: { requireMention?: boolean; senderPhone?: string } = {}
) {
  logger.info(` Audio recebido de ${phone}`);
  await markAsReading(phone);

  const buffer = await downloadMedia(messageKey, messageData);
  if (!buffer) {
    logger.error(` Falha ao baixar audio de ${phone}`);
    if (!options.requireMention) await enviarAvisoWhatsApp(phone, '❌ Não consegui baixar o áudio. Tente novamente.');
    return;
  }

  try {
    const text = await transcribeAudio(buffer, mimetype);
    if (!text) {
      if (!options.requireMention) await enviarAvisoWhatsApp(phone, '❌ Não consegui entender o áudio. Pode tentar de novo?');
      return;
    }

    // Em grupos: só responde se o bot foi chamado pelo nome no áudio
    if (options.requireMention && !BOT_MENTION_REGEX.test(text)) {
      logger.info(` Áudio em grupo transcrito mas bot não mencionado: "${text.slice(0, 80)}"`);
      return;
    }

    // Detecta se é um comando estruturado (lembrete, salvar memória, etc.)
    // Nesse caso, o Jarvis executa silenciosamente — a resposta já é auto-explicativa
    const isCommandIntent =
      REMINDER_REGEX.test(text) ||
      /salva\s+isso/i.test(text) ||
      /\/ajuda/i.test(text);

    // Só mostra transcrição para áudios "soltos" (conversa geral)
    // Se for um comando, o Jarvis responde diretamente sem repetir o áudio
    if (!options.requireMention && !isCommandIntent) {
      await enviarAvisoWhatsApp(phone, `🎤 *Transcrição:*\n_${text}_`);
    }

    await processMessage(phone, text, 'audio', options.senderPhone);
  } catch (e) {
    console.error('[Audio] Erro na transcricao:', e);
    if (!options.requireMention) await enviarAvisoWhatsApp(phone, '❌ Erro ao processar o áudio. Tente novamente.');
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

Regras CRITICAS:
- "whenMs" deve ser APENAS a hora em que o lembrete deve DISPARAR (tocar o alarme), NÃO datas mencionadas dentro das tarefas.
- Ignore datas que aparecem DENTRO do conteúdo das tarefas (ex: "fazer X na terça" → "terça" é quando fazer a tarefa, NÃO quando o lembrete dispara).
- Foco exclusivo: quando o usuario disse "me lembra AS X HORAS" ou "me avisa EM TAL DIA" — essa é a hora de disparo.
- Se nao houver data/hora especificada para o DISPARO, retorne null em "whenMs"
- Interprete "hoje", "amanha", "proxima semana", "daqui a X minutos/horas" corretamente usando o Unix timestamp fornecido
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

      if (pending.action === 'awaiting_email_selection') {
        let emailId: string | null = null;

        const selMatch = text.trim().match(/^sel([1-5])$/i);
        const numMatch = text.trim().match(/^[1-5]$/);
        if (selMatch && pending.emails?.length) {
          emailId = pending.emails[parseInt(selMatch[1], 10) - 1]?.id ?? null;
        } else if (numMatch && pending.emails?.length) {
          emailId = pending.emails[parseInt(text.trim(), 10) - 1]?.id ?? null;
        }

        if (!emailId) {
          await supabase.from('chats').delete().eq('phone', phone).eq('role', 'pending');
          await enviarAvisoWhatsApp(phone, '❌ Seleção inválida. Tente pedir os emails novamente.');
          return;
        }

        const selectedMeta = pending.emails?.find((e: any) => e.id === emailId);
        await markAsReading(phone);
        await enviarAvisoWhatsApp(phone, `📧 Buscando *${selectedMeta?.subject || 'email'}*...`);

        try {
          const adapter = new GraphCalendarAdapter();
          const fullEmail = await adapter.getFullEmail(pending.mailbox, emailId);

          const rawBody = fullEmail.body?.content || fullEmail.bodyPreview || '';
          const plainBody = rawBody
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 30000);

          const summaryResult = await generateText({
            model: getModel(),
            system: 'Você é um assistente executivo. Faça um resumo conciso do email em português. Use bullet points para múltiplos pontos. Destaque ações necessárias. Máximo 5 bullets ou 3 parágrafos curtos. Nunca invente informações.',
            messages: [{ role: 'user', content: `Assunto: ${fullEmail.subject}\n\n${plainBody}` }],
          });

          const date = selectedMeta?.date
            ? new Date(selectedMeta.date).toLocaleDateString('pt-BR', {
                timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
              })
            : '';
          const fromName = pending.senderName || fullEmail.from?.emailAddress?.name || '';
          const response = `📧 *${fullEmail.subject}*\n_De: ${fromName}${date ? ` • ${date}` : ''}_\n\n${summaryResult.text.trim()}`;

          await supabase.from('chats').delete().eq('phone', phone).eq('role', 'pending');
          await supabase.from('chats').insert({ phone, role: 'assistant', content: response, created_at: Date.now() });
          await enviarAvisoWhatsApp(phone, response);
        } catch (err: any) {
          logger.error('[EmailSelection] Erro ao buscar/resumir email:', err);
          await supabase.from('chats').delete().eq('phone', phone).eq('role', 'pending');
          await enviarAvisoWhatsApp(phone, '❌ Não consegui carregar o email. Tente novamente.');
        }
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
    const [messages, memoryContext, userName, isAllowedToSaveMemory] = await Promise.all([
      getSemanticHistory(text, phone, 10),
      getMemoryContext(text, phone),
      getUserName(senderPhone || phone),
      canStoreMemory(phone),
    ]);

    // ── LLM com tools (o modelo decide qual ferramenta chamar) ─────────────
    const chartRef: { data: { type: string; title: string; data: any[] } | null } = { data: null };

    const result = await generateText({
      model: getModel(),
      system: getWhatsAppSystemPrompt(memoryContext, userName),
      messages,
      tools: {
        searchProjects,
        searchNotion,
        getCalendarEvents,
        createProject,
        getProjectDetails,
        getDRMData,
        analyzeProjects,
        renderChart: createRenderChartTool(chartRef),
        searchDocuments,
        saveMemory: createMemoryTool(phone, isAllowedToSaveMemory),
        searchMemories: searchMemoriesTool(phone),
        deleteMemory: deleteMemoryTool(phone, isAllowedToSaveMemory),
        createReminder: createWhatsAppReminderTool(phone, senderPhone),
        listReminders: listRemindersTool(phone),
        cancelReminder: cancelReminderTool(phone),
        updateProjectStatus: updateProjectStatusTool,
        listarEmailsRemetente: createListarEmailsRemetenteTool(phone),
      },
      stopWhen: stepCountIs(5),
    });

    // Se o tool de email foi chamado, ele já enviou a mensagem diretamente — não enviar texto do LLM
    const emailToolCalled = result.steps?.some(step =>
      step.toolCalls?.some((tc: any) => tc.toolName === 'listarEmailsRemetente')
    );
    if (emailToolCalled) return;

    const assistantContent = result.text?.trim();
    if (!assistantContent) return;

    await supabase.from('chats').insert({ phone, role: 'assistant', content: assistantContent, created_at: Date.now() });

    if (chartRef.data) {
      const imageBase64 = await renderChartToBase64(chartRef.data);
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

      // Em grupos, só processa o PDF se o bot foi mencionado (na legenda ou via @mention)
      if (isGroup) {
        const caption = (docMsg.caption || '').toLowerCase();
        const isMentioned = mentionedJid.some((jid: string) => jid.includes(botIdentifier) || (botLid && jid.includes(botLid)))
          || caption.includes('@jarvis')
          || caption.includes('@ninjasearch')
          || caption.includes('@ninja');

        if (!isMentioned) {
          logger.info(` PDF em grupo ignorado (bot não mencionado): ${phone}`);
          return NextResponse.json({ status: 'ignored_not_mentioned_in_group' });
        }
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
      const audioOptions = { requireMention: !!isGroup, senderPhone };
      const isVercel = process.env.VERCEL === '1';
      if (isVercel) {
        waitUntil(processAudio(phone, key, msgData, mimetype, audioOptions));
      } else {
        processAudio(phone, key, msgData, mimetype, audioOptions).catch(e => logger.error(' Error:', e));
      }
      return NextResponse.json({ success: true });
    }

    // ── Áudio citado/respondido com pedido de transcrição ─────────────────────
    // Quando o usuário responde a um áudio com "me transcreve", o áudio vem
    // dentro de contextInfo.quotedMessage — e seria ignorado sem este bloco.
    const quotedCtx = msgData?.extendedTextMessage?.contextInfo;
    const quotedAudioData = quotedCtx?.quotedMessage?.audioMessage || quotedCtx?.quotedMessage?.pttMessage;
    const captionText = msgData?.extendedTextMessage?.text || '';

    if (phone && quotedAudioData && TRANSCRIPT_REQUEST_REGEX.test(captionText)) {
      const authorized = await checkAuthorization(phone, isGroup, isGroup ? phone : null);
      if (!authorized) return NextResponse.json({ status: 'unauthorized' });

      const quotedMimetype = quotedAudioData.mimetype || 'audio/ogg; codecs=opus';
      const quotedKey = quotedCtx?.quotedMessageKey || {};

      waitUntil((async () => {
        await markAsReading(phone);
        const buffer = await downloadMedia(quotedKey, quotedCtx?.quotedMessage);
        if (!buffer) {
          await enviarAvisoWhatsApp(phone, '❌ Não consegui acessar o áudio citado. Tente encaminhar o áudio diretamente.');
          return;
        }
        const transcript = await transcribeAudio(buffer, quotedMimetype);
        if (!transcript) {
          await enviarAvisoWhatsApp(phone, '❌ Não consegui transcrever o áudio. Pode tentar novamente?');
          return;
        }
        await enviarAvisoWhatsApp(phone, `🎤 *Transcrição:*\n_${transcript}_`);
      })());

      return NextResponse.json({ success: true });
    }

    // ── WhatsApp list reply (seleção interativa de email) ─────────────────────
    const listRowId = msgData?.listResponseMessage?.singleSelectReply?.selectedRowId;
    if (phone && listRowId) {
      const authorized = await checkAuthorization(phone, isGroup, isGroup ? phone : null);
      if (!authorized) {
        logger.info(` Número não autorizado (list reply): ${phone}`);
        return NextResponse.json({ status: 'unauthorized' });
      }
      if (process.env.VERCEL === '1') {
        waitUntil(processMessage(phone, listRowId, 'text', senderPhone));
      } else {
        processMessage(phone, listRowId, 'text', senderPhone).catch(e => logger.error(' Error:', e));
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
