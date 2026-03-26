import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const url = `https://${process.env.SUPABASE_PROJECT_ID || ''}.supabase.co`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(url, key);

async function check() {
  console.log("Checking DB Project:", process.env.SUPABASE_PROJECT_ID);
  const memories = await supabase.from('memories').select('*', { count: 'exact' });
  const docs = await supabase.from('documents').select('*', { count: 'exact' });
  const chunks = await supabase.from('document_chunks').select('*', { count: 'exact' });
  const chats = await supabase.from('chats').select('*', { count: 'exact' });
  
  console.log('--- TABLE COUNTS ---');
  console.log('Memories count:', memories.count);
  console.log('Documents count:', docs.count);
  console.log('Chunks count:', chunks.count);
  console.log('Chats count:', chats.count);

  if (chunks.data && chunks.data.length > 0) {
    console.log('\nSample chunk:', chunks.data[0]);
  }
}
check();
