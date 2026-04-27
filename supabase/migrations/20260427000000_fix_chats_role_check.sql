-- Adiciona 'pending' ao check constraint da coluna role na tabela chats
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_role_check;
ALTER TABLE chats ADD CONSTRAINT chats_role_check
  CHECK (role IN ('user', 'assistant', 'system', 'pending'));
