import { createClient } from '@supabase/supabase-js';

const url = `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!process.env.SUPABASE_PROJECT_ID) {
  throw new Error('Missing SUPABASE_PROJECT_ID in environment variables');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment variables');
}

export const supabase = createClient(url, key);

// Alias `db` para facilitar migração gradual — use supabase diretamente em código novo
export const db = supabase;
