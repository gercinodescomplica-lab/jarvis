-- Enrich reminders table with fields needed for full persistence
-- Previously only: id, message, remind_at, chat_id, sent, created_at

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS jid            TEXT,
  ADD COLUMN IF NOT EXISTS is_group       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trigger_run_id TEXT,
  ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'pending'
                                          CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  ADD COLUMN IF NOT EXISTS source         TEXT NOT NULL DEFAULT 'whatsapp'
                                          CHECK (source IN ('whatsapp', 'telegram', 'chat')),
  ADD COLUMN IF NOT EXISTS priority       TEXT NOT NULL DEFAULT 'normal'
                                          CHECK (priority IN ('low', 'normal', 'high')),
  ADD COLUMN IF NOT EXISTS recurrence     TEXT;

-- Backfill status from legacy `sent` column
UPDATE public.reminders SET status = 'sent' WHERE sent = true AND status = 'pending';

-- Index for per-user listing
CREATE INDEX IF NOT EXISTS idx_reminders_phone_status
  ON public.reminders(phone, status, remind_at);

-- Index for trigger run lookup (cancel/mark-sent flows)
CREATE INDEX IF NOT EXISTS idx_reminders_trigger_run_id
  ON public.reminders(trigger_run_id)
  WHERE trigger_run_id IS NOT NULL;
