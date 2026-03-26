import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const url = `https://${process.env.SUPABASE_PROJECT_ID || ''}.supabase.co`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('memories').select('*').limit(5);
  if (error) {
    console.error('Error fetching memories:', error);
  } else {
    console.log('Memories found:', data);
  }
}
check();
