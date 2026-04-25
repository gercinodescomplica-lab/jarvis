import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const projectId = process.env.SUPABASE_PROJECT_ID;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!projectId) throw new Error('Missing SUPABASE_PROJECT_ID in environment variables');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment variables');

  _client = createClient(`https://${projectId}.supabase.co`, key);
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});

export const db = supabase;
