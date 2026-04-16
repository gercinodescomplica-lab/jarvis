import { GraphCalendarAdapter } from '@jarvis/adapters/src/ms-graph';
import { supabase } from '@/db';
import { enviarAvisoWhatsApp } from '@/lib/evolution-client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('email-monitor');

const PRIORITY_EMOJI: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🔵',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Alta prioridade',
  medium: 'Média prioridade',
  low: 'Baixa prioridade',
};

export async function monitorarEmailsChave(): Promise<void> {
  const adapter = new GraphCalendarAdapter();

  // 1. Busca todas as caixas ativas que têm ao menos 1 remetente monitorado
  const { data: mailboxes, error: mbError } = await supabase
    .from('email_mailbox_configs')
    .select('mailbox, label, whatsapp_phone')
    .eq('active', true);

  if (mbError || !mailboxes?.length) {
    logger.info('[EmailMonitor] Nenhuma caixa ativa configurada.');
    return;
  }

  for (const mb of mailboxes) {
    try {
      await processarCaixa(adapter, mb.mailbox, mb.label, mb.whatsapp_phone);
    } catch (err) {
      logger.error(`[EmailMonitor] Erro ao processar caixa ${mb.mailbox}`, err);
    }
  }
}

async function processarCaixa(
  adapter: GraphCalendarAdapter,
  mailbox: string,
  label: string,
  whatsappPhone: string
): Promise<void> {
  // 2. Busca o delta token salvo para esta caixa
  const { data: tokenRow } = await supabase
    .from('email_delta_tokens')
    .select('delta_link')
    .eq('mailbox', mailbox)
    .single();

  const deltaLink = tokenRow?.delta_link ?? undefined;

  // 3. Chama a Graph API com delta query
  const { emails, nextDeltaLink } = await adapter.getEmailsDelta(mailbox, deltaLink);

  // 4. Persiste o novo delta token
  if (nextDeltaLink) {
    await supabase
      .from('email_delta_tokens')
      .upsert({ mailbox, delta_link: nextDeltaLink, updated_at: new Date().toISOString() });
  }

  // Primeira execução: apenas inicializa o delta, não notifica
  if (!deltaLink) {
    logger.info(`[EmailMonitor] Delta inicializado para ${mailbox}. Monitoramento ativo a partir de agora.`);
    return;
  }

  if (!emails.length) {
    logger.info(`[EmailMonitor] Nenhum email novo para ${mailbox}.`);
    return;
  }

  // 5. Busca a lista de remetentes monitorados desta caixa
  const { data: senders } = await supabase
    .from('monitored_senders')
    .select('sender_email, sender_name, priority')
    .eq('mailbox', mailbox)
    .eq('active', true);

  if (!senders?.length) return;

  const senderMap = new Map(senders.map(s => [s.sender_email.toLowerCase(), s]));

  // 6. Filtra emails cujo remetente está na lista monitorada
  const relevantes = emails
    .filter((e: any) => {
      const fromAddr = e.from?.emailAddress?.address?.toLowerCase() ?? '';
      return senderMap.has(fromAddr);
    })
    .map((e: any) => {
      const fromAddr = e.from?.emailAddress?.address?.toLowerCase();
      const sender = senderMap.get(fromAddr)!;
      return { ...e, _sender: sender };
    })
    .sort((a: any, b: any) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a._sender.priority as keyof typeof order] ?? 1) -
             (order[b._sender.priority as keyof typeof order] ?? 1);
    });

  if (!relevantes.length) {
    logger.info(`[EmailMonitor] ${emails.length} email(s) novo(s) em ${mailbox}, nenhum de remetente monitorado.`);
    return;
  }

  // 7. Formata e envia notificação WhatsApp
  const now = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let msg = `📧 *Emails Importantes — ${label}*\n_${now}_\n\n`;

  for (const e of relevantes) {
    const emoji = PRIORITY_EMOJI[e._sender.priority] ?? '⚪';
    const prioLabel = PRIORITY_LABEL[e._sender.priority] ?? '';
    const receivedAt = new Date(e.receivedDateTime).toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });
    const preview = (e.bodyPreview ?? '').slice(0, 120).replace(/\n/g, ' ');

    msg += `${emoji} *${e._sender.sender_name}* — ${prioLabel}\n`;
    msg += `🕐 ${receivedAt} · 📌 ${e.subject}\n`;
    if (preview) msg += `_"${preview}..."_\n`;
    msg += '\n';
  }

  msg += `_${relevantes.length} email(s) de remetentes monitorados_`;

  await enviarAvisoWhatsApp(whatsappPhone, msg);
  logger.info(`[EmailMonitor] Notificação enviada para ${whatsappPhone} (${relevantes.length} email(s)).`);
}
