import 'dotenv/config';
import { getAniversariantesHoje, formatarMensagemAniversario } from '../src/cron/aniversarios';
import { enviarAvisoWhatsApp } from '../src/cron/agenda';

async function main() {
  console.log('🔍 Buscando aniversariantes de hoje na planilha...');

  const aniversariantes = await getAniversariantesHoje();

  if (aniversariantes.length === 0) {
    console.log('✅ Nenhum aniversariante hoje. Nada a enviar.');
    return;
  }

  const mensagem = formatarMensagemAniversario(aniversariantes);
  console.log('\n📨 Mensagem que será enviada:\n');
  console.log(mensagem);

  const recipientsRaw = process.env.BIRTHDAY_RECIPIENTS || '';
  const recipients = recipientsRaw.split(',').map(r => r.trim()).filter(Boolean);

  if (recipients.length === 0) {
    console.warn('⚠️  Nenhum destinatário em BIRTHDAY_RECIPIENTS. Mensagem não enviada.');
    return;
  }

  for (const dest of recipients) {
    console.log(`\n📲 Enviando para ${dest}...`);
    await enviarAvisoWhatsApp(dest, mensagem);
    console.log(`✅ Enviado!`);
  }
}

main().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
