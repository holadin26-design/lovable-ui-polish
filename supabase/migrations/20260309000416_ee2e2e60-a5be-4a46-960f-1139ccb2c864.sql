-- Fix overly-permissive tracking_events INSERT policy flagged by linter

CREATE OR REPLACE FUNCTION public.set_tracking_event_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT f.user_id INTO v_user_id
  FROM public.followups f
  WHERE f.id = NEW.followup_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid followup_id';
  END IF;

  NEW.user_id = v_user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_tracking_event_user_id ON public.tracking_events;
CREATE TRIGGER set_tracking_event_user_id
BEFORE INSERT ON public.tracking_events
FOR EACH ROW
EXECUTE FUNCTION public.set_tracking_event_user_id();

ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert tracking events" ON public.tracking_events;

CREATE POLICY "Public can insert tracking events"
ON public.tracking_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.followups f
    WHERE f.id = tracking_events.followup_id
  )
);
