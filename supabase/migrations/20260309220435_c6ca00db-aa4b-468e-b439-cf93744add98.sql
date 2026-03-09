
-- Add MagicpitchWarmup fields to warmup_schedules
ALTER TABLE public.warmup_schedules 
  ADD COLUMN IF NOT EXISTS start_volume integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS increase_rate float NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS max_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS status_text text,
  ADD COLUMN IF NOT EXISTS addresses_mailed text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_responder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_open_rate float NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS target_reply_rate float NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- Create warmup_emails table for template content used during warmup
CREATE TABLE IF NOT EXISTS public.warmup_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  responses text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.warmup_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own warmup emails" ON public.warmup_emails
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own warmup emails" ON public.warmup_emails
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own warmup emails" ON public.warmup_emails
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own warmup emails" ON public.warmup_emails
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Seed some default warmup email templates (system-level, user_id will be set per-user)
-- Users will need to create their own templates
