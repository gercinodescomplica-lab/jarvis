-- Tabela de destinatários de avisos de aniversário
CREATE TABLE IF NOT EXISTS birthday_recipients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_id text NOT NULL UNIQUE, -- ex: 5511999999999@s.whatsapp.net ou 120363424207983724@g.us
  label       text NOT NULL,        -- nome amigável ex: "Gercino", "Dani", "Grupo Diretoria"
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
