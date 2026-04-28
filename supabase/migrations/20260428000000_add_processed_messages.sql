-- Tabela para deduplicação de mensagens em ambientes serverless (Vercel)
-- Garante que a mesma mensagem não seja processada duas vezes por instâncias concorrentes
CREATE TABLE IF NOT EXISTS processed_messages (
    msg_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
    PRIMARY KEY (msg_id)
);

-- Índice para limpeza periódica por data
CREATE INDEX IF NOT EXISTS idx_processed_messages_created_at ON processed_messages (created_at);

-- RLS: apenas service role pode acessar
ALTER TABLE processed_messages ENABLE ROW LEVEL SECURITY;
