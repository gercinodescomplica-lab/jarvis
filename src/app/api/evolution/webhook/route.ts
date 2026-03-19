import { NextResponse } from 'next/server';
import { supabase } from '@/db';
import { waitUntil } from '@vercel/functions';
import { GraphCalendarAdapter } from '@jarvis/adapters/src/ms-graph';
import { saveMemory, saveDocument, getMemoryContext, canStoreMemory } from '@/lib/memory-service';
import { JarvisIntelligence } from '@/lib/jarvis-intelligence';
import { reminderTask } from '@/trigger/reminder';
import { SpeechClient } from '@google-cloud/speech';

// ─── Calendar context ─────────────────────────────────────────────────────────

async function getCalendarContext(messages: any[]) {
  if (!messages || messages.length === 0) return "";

  const lastMessage = messages[messages.length - 1].content.toLowerCase();
  const hasKeywords = ["agenda", "calendário", "reunião", "compromissos", "meeting", "evento"].some(k => lastMessage.includes(k));
  const mentionsName = ["tiago", "danielle", "dani", "gercino", "neto"].some(k => lastMessage.includes(k));

  if (hasKeywords || mentionsName) {
    console.log("[Evolution Webhook] Detecting calendar intent, fetching data...");
    try {
      const adapter = new GraphCalendarAdapter();
      const configEmails = (process.env.GRAPH_USER_EMAILS || "").split(',').filter(Boolean);
      let targetEmails = configEmails;

      if (lastMessage.includes('tiago')) targetEmails = ['tiagoluz@prodam.sp.gov.br'];
      else if (lastMessage.includes('danielle') || lastMessage.includes('dani')) targetEmails = ['danielleoliveira@prodam.sp.gov.br'];
      else if (lastMessage.includes('gercino') || lastMessage.includes('neto')) targetEmails = ['gercinoneto@prodam.sp.gov.br'];

      const results = await adapter.getEventsForUsers(targetEmails);
      const eventsText = results.map(r => {
        if (r.error) return `- ${r.user}: Erro ao buscar dados.`;
        if (!r.events || r.events.length === 0) return `- ${r.user}: Sem compromissos encontrados para os próximos 7 dias.`;
        return `- ${r.user}:\n  ` + r.events.map((e: any) => {
          const eventDate = new Date(e.start.dateTime).toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          return `* ${e.subject} (${eventDate}) - Local: ${e.location?.displayName || 'N/A'}`;
        }).join('\n  ');
      }).join('\n');

      return `\n\nINFORMAÇÕES DE CALENDÁRIO (USE ISSO PARA RESPONDER):\n${eventsText}\n\n`;
    } catch (e) {
      console.error("Calendar fetch failed:", e);
    }
  }
  return "";
}

// ─── Evolution API config ─────────────────────────────────────────────────────

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'LiciMonitor';

async function enviarAvisoWhatsApp(telefone: string, mensagemTexto: string) {
  const telefoneLimpo = telefone.replace('+', '');
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_TOKEN || '' },
      body: JSON.stringify({ number: telefoneLimpo, text: mensagemTexto, linkPreview: false })
    });
    if (!response.ok) throw new Error(`Erro na API Evolution: ${await response.text()}`);
    return await response.json();
  } catch (error) {
    console.error("[Evolution] Falha ao enviar mensagem:", error);
  }
}

async function enviarSticker(telefone: string, stickerBase64: string) {
  const telefoneLimpo = telefone.replace('+', '');
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendSticker/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_TOKEN || '' },
      body: JSON.stringify({ number: telefoneLimpo, sticker: stickerBase64 })
    });
    if (!response.ok) throw new Error(`Erro na API Evolution: ${await response.text()}`);
    return await response.json();
  } catch (error) {
    console.error('[Evolution] Falha ao enviar sticker:', error);
  }
}

async function markAsReading(telefone: string) {
  const telefoneLimpo = telefone.replace('+', '');
  try {
    await fetch(`${EVOLUTION_API_URL}/chat/sendPresence/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_TOKEN || '' },
      body: JSON.stringify({ number: telefoneLimpo, delay: 1000, presence: "composing" })
    });
  } catch {
    // Ignore presence errors
  }
}

// Baixa mídia da Evolution API e retorna como Buffer
async function downloadMedia(messageKey: any, messageData: any): Promise<Buffer | null> {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_TOKEN || '' },
        body: JSON.stringify({ message: { key: messageKey, message: messageData } })
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const base64 = data.base64 || data.data?.base64;
    if (!base64) return null;
    return Buffer.from(base64, 'base64');
  } catch (e) {
    console.error('[Evolution] Falha ao baixar mídia:', e);
    return null;
  }
}

// ─── Processamento de PDF ─────────────────────────────────────────────────────

async function processPdf(phone: string, messageKey: any, messageData: any, filename: string) {
  console.log(`[PDF] 📨 PDF recebido de ${phone}: "${filename}"`);
  await enviarAvisoWhatsApp(phone, `📄 Recebi o PDF *${filename}*! Processando... aguarda um momento.`);

  const allowed = await canStoreMemory(phone);
  if (!allowed) {
    console.warn(`[PDF] ⛔ Sem permissão para salvar: ${phone}`);
    await enviarAvisoWhatsApp(phone, '❌ Você não tem permissão para salvar documentos na minha memória.');
    return;
  }

  console.log(`[PDF] ⬇️  Baixando mídia...`);
  const buffer = await downloadMedia(messageKey, messageData);
  if (!buffer) {
    console.error(`[PDF] ❌ Falha ao baixar mídia de ${phone}`);
    await enviarAvisoWhatsApp(phone, '❌ Não consegui baixar o PDF. Tente novamente.');
    return;
  }
  console.log(`[PDF] ✅ Mídia baixada: ${(buffer.length / 1024).toFixed(1)} KB`);

  try {
    const docId = await saveDocument(buffer, filename, phone);
    console.log(`[PDF] 🎉 Processo concluído! docId=${docId}`);

    // Guarda estado pendente para aguardar o assunto do usuário
    await supabase.from('chats').insert({
      phone,
      role: 'pending',
      content: JSON.stringify({ action: 'awaiting_pdf_title', document_id: docId }),
      created_at: Date.now(),
    });

    await enviarAvisoWhatsApp(phone, `✅ PDF processado! Qual o *assunto* deste documento? (isso me ajuda a organizá-lo melhor)`);
  } catch (e: any) {
    console.error(`[PDF] ❌ Erro ao processar "${filename}":`, e);
    await enviarAvisoWhatsApp(phone, `❌ Erro ao processar o PDF: ${e.message}`);
  }
}

// ─── Fast-path: Agenda ────────────────────────────────────────────────────────

const NOTION_KEYWORDS = ['projeto', 'projetos', 'notion', 'tarefa', 'tarefas', 'atrasado', 'atrasados', 'prazo', 'prazos', 'entrega', 'entregas', 'risco', 'roi', 'urgência', 'urgencia', 'importância', 'importancia', 'criar projeto', 'criar tarefa', 'quantos projeto'];

function isNotionQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return NOTION_KEYWORDS.some(k => lower.includes(k));
}

function formatNotionForWhatsApp(result: { type: string; data: any[]; summary: string; details?: string }): string {
  const { type, data, summary, details } = result;

  // Sem resultados
  if (type !== 'OVERDUE' && type !== 'DEADLINE' && data.length === 0) {
    return `🔍 ${summary}`;
  }

  // Contagem / listagem geral (LIST retorna muitos projetos)
  if (data.length > 10) {
    let msg = `📊 Você tem *${data.length} projetos* no Notion.\n\n`;
    msg += `Aqui estão os primeiros 10:\n`;
    data.slice(0, 10).forEach((p, i) => {
      const icon = p.status === 'Concluído' ? '✅' : '🚧';
      msg += `${i + 1}. ${icon} *${p.title}* — ${p.status}\n`;
    });
    msg += `\n_...e mais ${data.length - 10} projetos._\n`;
    msg += `\nPosso filtrar por status, urgência, risco ou prazo. É só pedir!`;
    return msg;
  }

  // Lista pequena (busca/filtro)
  if ((type === 'SEARCH' || type === 'FILTER') && data.length > 0) {
    let msg = `📋 *${summary}*\n\n`;
    data.forEach((p, i) => {
      const icon = p.status === 'Concluído' ? '✅' : '🚧';
      msg += `${i + 1}. ${icon} *${p.title}*`;
      if (p.status) msg += ` — ${p.status}`;
      if (p.deadline) msg += `\n   📅 ${p.deadline}`;
      msg += '\n';
    });
    return msg.trim();
  }

  // Atrasados
  if (type === 'OVERDUE') {
    if (data.length === 0) return '✅ Nenhum projeto atrasado no momento!';
    let msg = `⚠️ *${data.length} projeto${data.length > 1 ? 's' : ''} atrasado${data.length > 1 ? 's' : ''}:*\n\n`;
    data.slice(0, 10).forEach((p, i) => {
      msg += `${i + 1}. *${p.title}*`;
      if (p.deadline) msg += ` — venceu em ${p.deadline}`;
      msg += '\n';
    });
    if (data.length > 10) msg += `\n_...e mais ${data.length - 10}_`;
    return msg;
  }

  // Prazos próximos
  if (type === 'DEADLINE') {
    if (data.length === 0) return '📅 Nenhum prazo próximo nos próximos 14 dias.';
    let msg = `📅 *${data.length} entrega${data.length > 1 ? 's' : ''} próxima${data.length > 1 ? 's' : ''}:*\n\n`;
    data.forEach((p, i) => {
      msg += `${i + 1}. *${p.title}* — ${p.deadline}\n`;
    });
    return msg;
  }

  // Detalhes de um projeto
  if (type === 'DETAILS' && data[0]) {
    const p = data[0];
    let msg = `📄 *${p.title}*\n`;
    if (p.status) msg += `Status: ${p.status}\n`;
    if (p.importance && p.importance !== 'N/A') msg += `Importância: ${p.importance}\n`;
    if (p.risk && p.risk !== 'N/A') msg += `Risco: ${p.risk}\n`;
    if (p.deadline) msg += `Prazo: ${p.deadline}\n`;
    if (details) msg += `\n${details}`;
    return msg;
  }

  return summary;
}

const AGENDA_KEYWORDS = ['agenda', 'calendário', 'calendario', 'reunião', 'reuniao', 'compromisso', 'meeting', 'evento'];
const PEOPLE_MAP: Record<string, string> = {
  tiago: 'tiagoluz@prodam.sp.gov.br',
  danielle: 'danielleoliveira@prodam.sp.gov.br',
  dani: 'danielleoliveira@prodam.sp.gov.br',
  gercino: 'gercinoneto@prodam.sp.gov.br',
  neto: 'gercinoneto@prodam.sp.gov.br',
};

function isAgendaQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return AGENDA_KEYWORDS.some(k => lower.includes(k));
}

async function handleAgendaQuery(phone: string, text: string): Promise<void> {
  const lower = text.toLowerCase();

  // Detecta para qual pessoa a pergunta é
  let targetEmails = (process.env.GRAPH_USER_EMAILS || '').split(',').filter(Boolean);
  let personName = 'todos';
  for (const [name, email] of Object.entries(PEOPLE_MAP)) {
    if (lower.includes(name)) {
      targetEmails = [email];
      personName = name.charAt(0).toUpperCase() + name.slice(1);
      break;
    }
  }

  await enviarAvisoWhatsApp(phone, `📅 Buscando agenda de *${personName}*...`);

  try {
    const adapter = new GraphCalendarAdapter();
    const results = await adapter.getEventsForUsers(targetEmails);

    const messages: string[] = [];

    results.forEach(r => {
      const firstName = r.user.split('@')[0].split('.')[0];
      const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

      if (r.error) {
        messages.push(`❌ Erro ao buscar agenda de ${displayName}.`);
        return;
      }
      if (!r.events || r.events.length === 0) {
        messages.push(`✅ *${displayName}* não tem compromissos nos próximos 7 dias.`);
        return;
      }

      // Agrupa por dia
      const grouped: Record<string, string[]> = {};
      const sorted = [...r.events].sort((a: any, b: any) =>
        new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
      );

      sorted.forEach((e: any) => {
        const dt = new Date(e.start.dateTime);

        // Formata dia: "Seg, 17/03"
        const diaSemana = dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short' })
          .replace('.', '').replace(/^\w/, c => c.toUpperCase());
        const diaMes = dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
        const dayKey = `${diaSemana}, ${diaMes}`;

        const hora = dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

        // Extrai link de reunião online
        let meetingUrl = e.onlineMeetingUrl || '';

        // Tenta extrair URL da string de localização (ex: "Sala; https://meet.google.com/xxx")
        if (!meetingUrl) {
          const locRaw = e.location?.displayName || '';
          const urlMatch = locRaw.match(/https?:\/\/[^\s;,]+/);
          if (urlMatch) meetingUrl = urlMatch[0];
        }

        // Localização física limpa (ignora endereços longos e URLs)
        let localFisico = '';
        const locRaw = e.location?.displayName || '';
        if (locRaw && !locRaw.includes('http') && locRaw.length < 50) {
          // Só mostra se não for URL e não for endereço gigante
          if (!locRaw.match(/,.*,.*,/)) { // ignora strings com 3+ vírgulas (endereço completo)
            localFisico = locRaw;
          }
        }

        // Monta linha do evento
        let line = `🕐 *${hora}* — ${e.subject}`;
        if (localFisico && !meetingUrl) {
          line += `\n    📍 ${localFisico}`;
        }
        if (meetingUrl) {
          // Encurta URL do Teams que são gigantes
          if (meetingUrl.includes('teams.microsoft.com')) {
            line += `\n    📹 Teams: ${meetingUrl}`;
          } else if (meetingUrl.includes('meet.google.com')) {
            line += `\n    📹 Meet: ${meetingUrl}`;
          } else {
            line += `\n    🔗 ${meetingUrl}`;
          }
        }

        if (!grouped[dayKey]) grouped[dayKey] = [];
        grouped[dayKey].push(line);
      });

      // Monta mensagem por dia (uma mensagem por dia para não ficar gigante)
      let header = `📆 *Agenda de ${displayName} — próximos 7 dias*\n`;
      let fullReport = header;

      for (const [day, events] of Object.entries(grouped)) {
        fullReport += `\n*${day}*\n${events.join('\n')}\n`;
      }

      messages.push(fullReport.trim());
    });

    // Envia tudo numa mensagem só
    await enviarAvisoWhatsApp(phone, messages.join('\n\n'));

  } catch (err) {
    console.error('[Agenda Fast-Path] Erro:', err);
    await enviarAvisoWhatsApp(phone, '❌ Não consegui buscar a agenda agora. Tente novamente.');
  }
}

// ─── Processamento de áudio (STT via Google Cloud Speech) ─────────────────

const speechClient = new SpeechClient({ keyFilename: 'google-credentials.json' });

async function transcribeAudio(buffer: Buffer, mimetype: string): Promise<string> {
  let encoding: 'OGG_OPUS' | 'MP3' | 'WEBM_OPUS' | 'LINEAR16' = 'OGG_OPUS';
  if (mimetype?.includes('mp3') || mimetype?.includes('mpeg')) encoding = 'MP3';
  else if (mimetype?.includes('webm')) encoding = 'WEBM_OPUS';
  else if (mimetype?.includes('wav')) encoding = 'LINEAR16';

  console.log(`[STT] Transcrevendo ${(buffer.length / 1024).toFixed(1)} KB via Google Speech (${encoding})`);

  const [response] = await speechClient.recognize({
    audio: { content: buffer.toString('base64') },
    config: {
      encoding,
      sampleRateHertz: 16000,
      languageCode: 'pt-BR',
      alternativeLanguageCodes: ['en-US'],
      model: 'latest_long',
      enableAutomaticPunctuation: true,
    },
  });

  const text = response.results
    ?.map(r => r.alternatives?.[0]?.transcript)
    .filter(Boolean)
    .join(' ') || '';

  console.log(`[STT] Resultado: "${text.slice(0, 100)}"`);
  return text;
}

async function inferSubjectFromText(text: string): Promise<string> {
  try {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT || 'https://oia-gercinotest.openai.azure.com/';
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1-mini';
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
    const azureUrl = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey || '' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Gere um titulo curto (3-5 palavras) em portugues para o seguinte conteudo. Responda APENAS com o titulo, sem pontuacao.' },
          { role: 'user', content: text.slice(0, 500) },
        ],
        stream: false,
      }),
    });

    if (!response.ok) return 'Audio';
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || 'Audio';
  } catch {
    return 'Audio';
  }
}

async function processAudio(phone: string, messageKey: Record<string, unknown>, messageData: Record<string, unknown>, mimetype: string) {
  console.log(`[Audio] Audio recebido de ${phone}`);
  await markAsReading(phone);

  const buffer = await downloadMedia(messageKey, messageData);
  if (!buffer) {
    console.error(`[Audio] Falha ao baixar audio de ${phone}`);
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

const REMINDER_REGEX = /me\s+lemb(?:re|ra)\s+d[ae]?\s+|lembrete[:\s]+|me\s+avis[ae]\s+(?:d[ae]\s+)?|n(?:ao|ão)\s+(?:me\s+)?(?:deixa|deixe)\s+(?:eu\s+)?esquecer/i;

async function parseReminder(text: string): Promise<{ what: string; when: Date } | null> {
  const nowBRT = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' });

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT || 'https://oia-gercinotest.openai.azure.com/';
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1-mini';
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
  const azureUrl = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const response = await fetch(azureUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey || '' },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: `Extraia o lembrete da mensagem. Data/hora atual em Brasilia: ${nowBRT}.
Retorne um JSON com:
- "what": o que deve ser lembrado (texto limpo, sem "me lembre de", etc.)
- "when": data e hora em formato ISO 8601 com timezone -03:00

Regras:
- Se nao houver data/hora especificada, retorne null em "when"
- Interprete "amanha", "proxima semana", "daqui a X minutos/horas" corretamente
- Sempre inclua o timezone -03:00 no "when"

Responda APENAS com JSON valido, sem markdown.`,
        },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      stream: false,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');

  if (!parsed.what || !parsed.when) return null;

  const when = new Date(parsed.when);
  if (isNaN(when.getTime()) || when <= new Date()) return null;

  return { what: parsed.what, when };
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

    // ── Fast-path: Agenda (Graph API direto, sem LLM) ─────────────────────────
    if (isAgendaQuery(text)) {
      await handleAgendaQuery(phone, text);
      return;
    }

    // ── Intent de lembrete ────────────────────────────────────────────────────
    if (REMINDER_REGEX.test(text)) {
      const parsed = await parseReminder(text);
      if (parsed) {
        const isGroup = phone.includes('@g.us');
        const resolvedSenderPhone = senderPhone || phone.replace(/@.+/, '').replace(/\D/g, '');

        await reminderTask.trigger(
          { senderPhone: resolvedSenderPhone, jid: phone, isGroup, reminder: parsed.what },
          { delay: parsed.when }
        );

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

    // Busca histórico (últimas 10 msgs)
    const { data: rawHistory } = await supabase
      .from('chats')
      .select('role, content, created_at')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(10);
    const messages = (rawHistory ?? []).reverse().map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));

    // Busca contexto de memória (sem calendar, já tratado no fast-path)
    const memoryContext = await getMemoryContext(text);

    // ── Fast-path: Notion (resposta direta com dados reais, sem passar pelo LLM) ─
    if (isNotionQuery(text)) {
      try {
        console.log('[Evolution Webhook] Notion intent detected, fetching real data...');
        const result = await JarvisIntelligence.processQuery(text);

        if (result.type !== 'CHIT_CHAT') {
          const notionReply = formatNotionForWhatsApp(result);
          await supabase.from('chats').insert({ phone, role: 'assistant', content: notionReply, created_at: Date.now() });
          await enviarAvisoWhatsApp(phone, notionReply);
          return;
        }
      } catch (e) {
        console.error('[Evolution Webhook] Notion fetch failed:', e);
        // fall through to LLM
      }
    }

    // Chama LLM
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "https://oia-gercinotest.openai.azure.com/";
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4.1-mini";
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview";
    const azureUrl = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const systemPrompt = `You are Rex, a highly advanced AI Assistant available on WhatsApp. Be warm, concise and helpful.
FORMATTING RULES FOR WHATSAPP:
- Use *asterisks* for bold text instead of markdown double-asterisks (e.g., *bold*).
- Use _underscores_ for italic text (e.g., _italic_).
- Do not use markdown headers (#) or markdown links [text](url).
- Keep responses short, as users are reading on a mobile device.
CURRENT BRAZIL DATE/TIME: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}${memoryContext}`;

    const response = await fetch(azureUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey || "" },
      body: JSON.stringify({
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: false
      })
    });

    if (!response.ok) throw new Error(`Azure AI Error: ${await response.text()}`);

    const data = await response.json();
    const assistantContent = data.choices?.[0]?.message?.content || "Desculpe, tive um problema ao processar sua resposta.";

    await supabase.from('chats').insert({ phone, role: 'assistant', content: assistantContent, created_at: Date.now() });
    await enviarAvisoWhatsApp(phone, assistantContent);

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
    console.warn(`[StickerEmoji] Sticker não encontrado: ${stickerPath}`);
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

async function checkAuthorization(phone: string, isGroup: boolean, groupJid: string | null): Promise<boolean> {
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
    if (e?.message !== 'DB timeout') console.warn('[Auth] DB erro:', e?.message);
    else console.warn('[Auth] DB timeout → usando fallback JSON');
  }

  const perms = getPermissionsFromJson();
  return !!Object.entries(perms.users || {}).find(([k]) => phone.includes(k));
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
        console.log(`[PDF] Número não autorizado: ${phone}`);
        return NextResponse.json({ status: 'unauthorized' });
      }

      waitUntil(processPdf(phone, key, msgData, filename));
      return NextResponse.json({ success: true });
    }

    // ── Áudio recebido (nota de voz ou arquivo de áudio) ──────────────────────
    const audioMsg = msgData?.audioMessage || msgData?.pttMessage;
    if (phone && audioMsg) {
      const authorized = await checkAuthorization(phone, isGroup, isGroup ? phone : null);
      if (!authorized) {
        console.log(`[Audio] Número não autorizado: ${phone}`);
        return NextResponse.json({ status: 'unauthorized' });
      }

      const mimetype = audioMsg.mimetype || 'audio/ogg; codecs=opus';
      const isVercel = process.env.VERCEL === '1';
      if (isVercel) {
        waitUntil(processAudio(phone, key, msgData, mimetype));
      } else {
        processAudio(phone, key, msgData, mimetype).catch(e => console.error('[processAudio] Error:', e));
      }
      return NextResponse.json({ success: true });
    }

    // ── Mensagem de texto ──────────────────────────────────────────────────────
    const text = msgData?.conversation || msgData?.extendedTextMessage?.text;

    if (!phone || !text) return NextResponse.json({ status: 'ignored' });

    let authorized = false;

    if (isGroup) {
      console.log(`[Evolution Group Check] JID chegou: ${phone}`);
      const perms = getPermissionsFromJson();
      const groupAuth = Object.values(perms.groups || {}).find((g: any) => g.jid === phone);

      if (!groupAuth) {
        console.log(`[Evolution Group Check] ❌ Grupo bloqueado: ${phone}`);
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
        console.log(`[Evolution User Check] ❌ Número não autorizado: ${phone}`);
        return NextResponse.json({ status: 'unauthorized_number' });
      }
    }

    if (authorized) {
      // Remove menções (@Jarvis, @ninja, etc.) para checar easter eggs em grupos
      const cleanText = text.replace(/@\S+/g, '').trim();

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
        processMessage(phone, text, 'text', senderPhone).catch(e => console.error('[processMessage] Error:', e));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Evolution Webhook] Parse Error:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
