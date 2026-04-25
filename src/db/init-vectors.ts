import { supabase } from './index';

let initialized = false;

export async function initVectorTables() {
  if (initialized) return;

  // Habilita pgvector e cria tabelas/funções se necessário
  // ATENÇÃO: as tabelas devem ser criadas via supabase-migration.sql no dashboard do Supabase
  // Esta função só garante que a extensão está ativa
  const { error } = await supabase.rpc('enable_pgvector');
  if (error && !error.message.includes('already exists')) {
    console.warn('[VectorDB] Aviso ao habilitar pgvector:', error.message);
  }

  initialized = true;
  console.log('[VectorDB] Supabase pgvector inicializado.');
}

// Cliente de vetores agora é o próprio supabase
export { supabase as rawClient };
