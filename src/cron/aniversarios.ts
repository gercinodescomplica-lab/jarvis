import { GoogleAuth } from 'google-auth-library';
import path from 'path';

const SPREADSHEET_ID = process.env.BIRTHDAY_SPREADSHEET_ID || '1tlvcD2t8IR9DIoAatJNullKneZJHXQm7xK7B8enpDOc';
const SHEET_RANGE = 'A:E'; // Diretoria | Aniversariante | Data (DD/MM) | vazio | Data completa (DD/MM/YYYY)
const CREDENTIALS_PATH = path.resolve(process.cwd(), 'google-credentials.json');

interface Aniversariante {
  diretoria: string;
  nome: string;
  dataNascimento: string; // DD/MM/YYYY
  anosCompletos: number;
}

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error('[Aniversários] Não foi possível obter token de acesso.');
  return tokenResponse.token;
}

async function lerPlanilha(): Promise<string[][]> {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_RANGE}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[Aniversários] Erro ao ler planilha: ${err}`);
  }

  const data = await response.json() as { values?: string[][] };
  return data.values || [];
}

export async function getAniversariantesHoje(): Promise<Aniversariante[]> {
  const rows = await lerPlanilha();
  if (rows.length < 2) return [];

  const hoje = new Date();
  const todayDay = String(hoje.getDate()).padStart(2, '0');
  const todayMonth = String(hoje.getMonth() + 1).padStart(2, '0');
  const todayDDMM = `${todayDay}/${todayMonth}`;

  const aniversariantes: Aniversariante[] = [];

  // Pula a linha de cabeçalho (row[0])
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const diretoria = (row[0] || '').trim();
    const nome = (row[1] || '').trim();
    const dataCurta = (row[2] || '').trim(); // DD/MM
    const dataCompleta = (row[4] || '').trim(); // DD/MM/YYYY

    if (!nome || !dataCurta) continue;

    // Normaliza separadores (pode vir como DD/MM ou DD-MM)
    const dataNorm = dataCurta.replace(/-/g, '/');

    if (dataNorm !== todayDDMM) continue;

    // Calcula a idade se tiver o ano disponível
    let anosCompletos = 0;
    if (dataCompleta) {
      const partes = dataCompleta.replace(/-/g, '/').split('/');
      const ano = parseInt(partes[2], 10);
      if (!isNaN(ano) && ano > 1900) {
        anosCompletos = hoje.getFullYear() - ano;
      }
    }

    aniversariantes.push({ diretoria, nome, dataNascimento: dataCompleta, anosCompletos });
  }

  return aniversariantes;
}

export function formatarMensagemAniversario(aniversariantes: Aniversariante[]): string {
  if (aniversariantes.length === 0) return '';

  const hoje = new Date();
  const dataHoje = hoje.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  let msg = `🎂 *Aniversariantes de hoje!*\n_${dataHoje}_\n\n`;

  for (const p of aniversariantes) {
    const dirTag = p.diretoria ? ` _(${p.diretoria})_` : '';
    if (p.anosCompletos > 0) {
      msg += `🎉 *${p.nome}*${dirTag} está fazendo *${p.anosCompletos} anos* hoje!\n`;
    } else {
      msg += `🎉 *${p.nome}*${dirTag} está de aniversário hoje!\n`;
    }
  }

  msg += `\nParabéns a todos os aniversariantes! 🥳`;
  return msg;
}
