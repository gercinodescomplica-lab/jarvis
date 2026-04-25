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

export interface EmailMailboxConfig {
  mailbox: string;
  label: string;
  whatsapp_phone: string;
  active: boolean;
  created_at: string;
}

export interface MonitoredSender {
  id: string;
  mailbox: string;
  sender_email: string;
  sender_name: string;
  priority: 'high' | 'medium' | 'low';
  active: boolean;
  created_at: string;
}

export interface EmailDeltaToken {
  mailbox: string;
  delta_link: string;
  updated_at: string;
}
