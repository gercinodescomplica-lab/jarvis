import { createLogger } from './logger';
import { retryAsync } from './retry';

const logger = createLogger('evolution');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'LiciMonitor';

function evolutionHeaders() {
  return { 'Content-Type': 'application/json', apikey: EVOLUTION_API_TOKEN || '' };
}

export async function enviarAvisoWhatsApp(telefone: string, mensagemTexto: string) {
  const telefoneLimpo = telefone.replace('+', '');
  return retryAsync(
    async () => {
      const response = await fetch(
        `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
        {
          method: 'POST',
          headers: evolutionHeaders(),
          body: JSON.stringify({ number: telefoneLimpo, text: mensagemTexto, linkPreview: false }),
        }
      );
      if (!response.ok) throw new Error(`Evolution API error: ${await response.text()}`);
      return response.json();
    },
    {
      attempts: 3,
      delayMs: 500,
      onRetry: (attempt, err) =>
        logger.warn(`enviarAvisoWhatsApp tentativa ${attempt} falhou`, err),
    }
  ).catch(err => logger.error('Falha ao enviar mensagem após 3 tentativas', err));
}

export async function enviarSticker(telefone: string, stickerBase64: string) {
  const telefoneLimpo = telefone.replace('+', '');
  return retryAsync(
    async () => {
      const response = await fetch(
        `${EVOLUTION_API_URL}/message/sendSticker/${EVOLUTION_INSTANCE}`,
        {
          method: 'POST',
          headers: evolutionHeaders(),
          body: JSON.stringify({ number: telefoneLimpo, sticker: stickerBase64 }),
        }
      );
      if (!response.ok) throw new Error(`Evolution API error: ${await response.text()}`);
      return response.json();
    },
    {
      attempts: 2,
      delayMs: 300,
      onRetry: (attempt, err) =>
        logger.warn(`enviarSticker tentativa ${attempt} falhou`, err),
    }
  ).catch(err => logger.error('Falha ao enviar sticker', err));
}

export async function markAsReading(telefone: string) {
  const telefoneLimpo = telefone.replace('+', '');
  try {
    await fetch(`${EVOLUTION_API_URL}/chat/sendPresence/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: evolutionHeaders(),
      body: JSON.stringify({ number: telefoneLimpo, delay: 1000, presence: 'composing' }),
    });
  } catch {
    // Erros de presença são silenciosos — não afetam a UX
  }
}

export async function enviarImagemWhatsApp(telefone: string, imageBase64: string, caption?: string) {
  const telefoneLimpo = telefone.replace('+', '');
  return retryAsync(
    async () => {
      const response = await fetch(
        `${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`,
        {
          method: 'POST',
          headers: evolutionHeaders(),
          body: JSON.stringify({
            number: telefoneLimpo,
            mediatype: 'image',
            mimetype: 'image/png',
            media: imageBase64,
            caption: caption || '',
          }),
        }
      );
      if (!response.ok) throw new Error(`Evolution API error: ${await response.text()}`);
      return response.json();
    },
    {
      attempts: 2,
      delayMs: 500,
      onRetry: (attempt, err) =>
        logger.warn(`enviarImagemWhatsApp tentativa ${attempt} falhou`, err),
    }
  ).catch(err => logger.error('Falha ao enviar imagem', err));
}

export async function enviarListaWhatsApp(
  telefone: string,
  titulo: string,
  descricao: string,
  rows: Array<{ title: string; description: string; rowId: string }>
) {
  const telefoneLimpo = telefone.replace(/\D/g, '');
  return retryAsync(
    async () => {
      const response = await fetch(
        `${EVOLUTION_API_URL}/message/sendList/${EVOLUTION_INSTANCE}`,
        {
          method: 'POST',
          headers: evolutionHeaders(),
          body: JSON.stringify({
            number: telefoneLimpo,
            title: titulo,
            description: descricao,
            buttonText: 'Ver emails',
            footerText: 'Jarvis',
            sections: [{ title: 'Selecione um email', rows }],
          }),
        }
      );
      if (!response.ok) throw new Error(`Evolution API error: ${await response.text()}`);
      return response.json();
    },
    {
      attempts: 3,
      delayMs: 500,
      onRetry: (attempt, err) =>
        logger.warn(`enviarListaWhatsApp tentativa ${attempt} falhou`, err),
    }
  ).catch(err => logger.error('Falha ao enviar lista WhatsApp', err));
}

export async function downloadMedia(
  messageKey: unknown,
  messageData: unknown
): Promise<Buffer | null> {
  return retryAsync(
    async () => {
      const response = await fetch(
        `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`,
        {
          method: 'POST',
          headers: evolutionHeaders(),
          body: JSON.stringify({ message: { key: messageKey, message: messageData } }),
        }
      );
      if (!response.ok) throw new Error(`Evolution API error: ${response.status}`);
      const data = await response.json();
      const base64 = data.base64 || data.data?.base64;
      if (!base64) throw new Error('Base64 ausente na resposta');
      return Buffer.from(base64, 'base64');
    },
    {
      attempts: 2,
      delayMs: 400,
      onRetry: (attempt, err) =>
        logger.warn(`downloadMedia tentativa ${attempt} falhou`, err),
    }
  ).catch(err => {
    logger.error('Falha ao baixar mídia', err);
    return null;
  });
}
