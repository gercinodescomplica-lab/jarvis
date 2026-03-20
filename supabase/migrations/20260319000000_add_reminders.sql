create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  remind_at timestamptz not null,
  chat_id text not null,
  sent boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_reminders_due on public.reminders(remind_at) where sent = false;
