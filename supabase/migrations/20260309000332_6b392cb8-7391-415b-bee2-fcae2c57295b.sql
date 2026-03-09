-- Create campaign steps table used by the UI
CREATE TABLE IF NOT EXISTS public.campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  variant_label text NOT NULL DEFAULT 'A',
  delay_days integer NOT NULL DEFAULT 0,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, step_order, variant_label)
);

CREATE INDEX IF NOT EXISTS idx_campaign_steps_campaign_order
  ON public.campaign_steps (campaign_id, step_order);

ALTER TABLE public.campaign_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own campaign steps" ON public.campaign_steps;
DROP POLICY IF EXISTS "Users can create own campaign steps" ON public.campaign_steps;
DROP POLICY IF EXISTS "Users can update own campaign steps" ON public.campaign_steps;
DROP POLICY IF EXISTS "Users can delete own campaign steps" ON public.campaign_steps;

CREATE POLICY "Users can view own campaign steps"
ON public.campaign_steps
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own campaign steps"
ON public.campaign_steps
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaign steps"
ON public.campaign_steps
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaign steps"
ON public.campaign_steps
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_campaign_steps_updated_at ON public.campaign_steps;
CREATE TRIGGER update_campaign_steps_updated_at
BEFORE UPDATE ON public.campaign_steps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- Create email validations table used by validate-leads function
CREATE TABLE IF NOT EXISTS public.email_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL,
  syntax_valid boolean NOT NULL DEFAULT false,
  mx_valid boolean NOT NULL DEFAULT false,
  is_disposable boolean NOT NULL DEFAULT false,
  is_catchall boolean NOT NULL DEFAULT false,
  validated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_email_validations_user_id
  ON public.email_validations (user_id);

ALTER TABLE public.email_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own email validations" ON public.email_validations;
DROP POLICY IF EXISTS "Users can create own email validations" ON public.email_validations;
DROP POLICY IF EXISTS "Users can update own email validations" ON public.email_validations;
DROP POLICY IF EXISTS "Users can delete own email validations" ON public.email_validations;

CREATE POLICY "Users can view own email validations"
ON public.email_validations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own email validations"
ON public.email_validations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email validations"
ON public.email_validations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email validations"
ON public.email_validations
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_email_validations_updated_at ON public.email_validations;
CREATE TRIGGER update_email_validations_updated_at
BEFORE UPDATE ON public.email_validations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- Add missing columns used by AI + validation flows
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS validation_status text,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_pain_points text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS ai_relevancy_score integer,
  ADD COLUMN IF NOT EXISTS ai_personalized_line text,
  ADD COLUMN IF NOT EXISTS ai_researched_at timestamp with time zone;