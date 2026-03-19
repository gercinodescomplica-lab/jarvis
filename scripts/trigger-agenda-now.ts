import * as dotenv from 'dotenv';
dotenv.config();

import { sendAgendaTask } from '../src/trigger/agenda';

async function main() {
  console.log('🚀 Disparando agenda agora...');
  const result = await sendAgendaTask.trigger({});
  console.log('✅ Run criado:', JSON.stringify(result, null, 2));
}

main().catch(e => {
  console.error('❌ Erro:', e);
  process.exit(1);
});
