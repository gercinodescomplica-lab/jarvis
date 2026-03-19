// Tipos TypeScript que espelham as tabelas do Supabase
// As tabelas são criadas via SQL — ver supabase-migration.sql na raiz do projeto

export type ChatRole = 'user' | 'assistant' | 'system';

export interface Chat {
  id: string;
  phone: string;
  role: ChatRole;
  content: string;
  created_at: number;
}

export interface Whitelist {
  phone: string;
  name: string;
  can_store_memory: boolean;
  active: boolean;
  created_at: number;
}

export interface Document {
  id: string;
  uploader_phone: string;
  filename: string;
  description: string | null;
  total_chunks: number;
  created_at: number;
}
