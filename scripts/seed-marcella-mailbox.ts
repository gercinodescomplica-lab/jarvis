import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const projectId = process.env.SUPABASE_PROJECT_ID!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(`https://${projectId}.supabase.co`, key);

async function main() {
  const { error } = await supabase
    .from('email_mailbox_configs')
    .upsert({
      mailbox: 'marcellabatista@prodam.sp.gov.br',
      label: 'Marcella Batista',
      whatsapp_phone: '5511961117448',
      active: true,
    }, { onConflict: 'mailbox' });

  if (error) {
    console.error('❌ Erro ao inserir mailbox da Marcella:', error);
    process.exit(1);
  }

  console.log('✅ Mailbox da Marcella configurado com sucesso!');
  console.log('');
  console.log('⚠️  Lembre-se de adicionar os remetentes monitorados na tabela monitored_senders:');
  console.log('   INSERT INTO monitored_senders (mailbox, sender_email, sender_name, priority)');
  console.log("   VALUES ('marcellabatista@prodam.sp.gov.br', 'remetente@dominio.com', 'Nome', 'high');");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
