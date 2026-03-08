-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Email accounts (SMTP/IMAP credentials per user)
CREATE TABLE public.email_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  smtp_host TEXT NOT NULL DEFAULT 'smtp.gmail.com',
  smtp_port INTEGER NOT NULL DEFAULT 587,
  imap_host TEXT NOT NULL DEFAULT 'imap.gmail.com',
  imap_port INTEGER NOT NULL DEFAULT 993,
  app_password TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  daily_send_limit INTEGER NOT NULL DEFAULT 50,
  sends_today INTEGER NOT NULL DEFAULT 0,
  warmup_enabled BOOLEAN NOT NULL DEFAULT false,
  warmup_level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own email accounts" ON public.email_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own email accounts" ON public.email_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email accounts" ON public.email_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own email accounts" ON public.email_accounts FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_email_accounts_updated_at BEFORE UPDATE ON public.email_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Templates
CREATE TABLE public.templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own templates" ON public.templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own templates" ON public.templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON public.templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON public.templates FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Follow-ups
CREATE TYPE public.followup_status AS ENUM ('pending', 'sent', 'cancelled', 'replied', 'failed');

CREATE TABLE public.followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  thread_id TEXT,
  message_id TEXT,
  status public.followup_status NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own followups" ON public.followups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own followups" ON public.followups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own followups" ON public.followups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own followups" ON public.followups FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_followups_updated_at BEFORE UPDATE ON public.followups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campaigns
CREATE TYPE public.campaign_status AS ENUM ('draft', 'active', 'paused', 'completed');

CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  followup_delay_hours INTEGER NOT NULL DEFAULT 48,
  max_followups INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Leads
CREATE TYPE public.lead_status AS ENUM ('imported', 'active', 'replied', 'bounced', 'unsubscribed', 'duplicate');

CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  status public.lead_status NOT NULL DEFAULT 'imported',
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own leads" ON public.leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own leads" ON public.leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own leads" ON public.leads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own leads" ON public.leads FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Warmup tracking
CREATE TYPE public.warmup_status AS ENUM ('active', 'paused', 'completed');

CREATE TABLE public.warmup_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  status public.warmup_status NOT NULL DEFAULT 'active',
  current_daily_limit INTEGER NOT NULL DEFAULT 5,
  target_daily_limit INTEGER NOT NULL DEFAULT 50,
  ramp_increment INTEGER NOT NULL DEFAULT 3,
  days_active INTEGER NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_received INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.warmup_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own warmup schedules" ON public.warmup_schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own warmup schedules" ON public.warmup_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own warmup schedules" ON public.warmup_schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own warmup schedules" ON public.warmup_schedules FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_warmup_schedules_updated_at BEFORE UPDATE ON public.warmup_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Warmup email logs
CREATE TABLE public.warmup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  warmup_schedule_id UUID NOT NULL REFERENCES public.warmup_schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('sent', 'received')),
  partner_email TEXT NOT NULL,
  subject TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.warmup_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own warmup logs" ON public.warmup_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own warmup logs" ON public.warmup_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_followups_user_status ON public.followups (user_id, status);
CREATE INDEX idx_followups_scheduled ON public.followups (scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_leads_user_campaign ON public.leads (user_id, campaign_id);
CREATE INDEX idx_warmup_schedules_account ON public.warmup_schedules (email_account_id);
CREATE INDEX idx_warmup_logs_schedule ON public.warmup_logs (warmup_schedule_id);