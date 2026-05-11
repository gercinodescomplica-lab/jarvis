-- Mapeamento WhatsApp phone → managerId do dashboard comercial
CREATE TABLE IF NOT EXISTS public.grc_users (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT    NOT NULL UNIQUE,      -- só dígitos + DDI: "5511999990000"
  manager_id  TEXT    NOT NULL,             -- ID interno do gerente: "kam1-malde"
  display_name TEXT   NOT NULL,             -- nome amigável para exibição
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grc_users_phone  ON public.grc_users(phone);
CREATE INDEX IF NOT EXISTS idx_grc_users_active ON public.grc_users(phone) WHERE active = true;
