-- Configuração por caixa de email monitorada
create table if not exists public.email_mailbox_configs (
  mailbox         text primary key,              -- tiagoluz@prodam.sp.gov.br
  label           text not null,                 -- "Tiago Luz"
  whatsapp_phone  text not null,                 -- destinatário WhatsApp das notificações
  active          boolean not null default true,
  created_at      timestamptz default now()
);

-- Remetentes monitorados por caixa
create table if not exists public.monitored_senders (
  id            uuid primary key default gen_random_uuid(),
  mailbox       text not null references public.email_mailbox_configs(mailbox) on delete cascade,
  sender_email  text not null,
  sender_name   text not null,
  priority      text not null default 'medium',  -- 'high' | 'medium' | 'low'
  active        boolean not null default true,
  created_at    timestamptz default now(),
  unique(mailbox, sender_email)
);

-- Delta tokens para polling eficiente (Strategy B)
-- Armazena apenas o link da última leitura por caixa — sem histórico de emails
create table if not exists public.email_delta_tokens (
  mailbox     text primary key,
  delta_link  text not null,
  updated_at  timestamptz default now()
);

create index if not exists idx_monitored_senders_mailbox
  on public.monitored_senders(mailbox) where active = true;

create index if not exists idx_monitored_senders_priority
  on public.monitored_senders(mailbox, priority) where active = true;
