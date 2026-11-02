-- Tiket sekali pakai agar karyawan AI boleh mengubah brief tanpa mematikan trigger.
-- User manusia tetap hanya boleh mengubah brief bila ia PIC plan itu.

CREATE TABLE public.ai_employee_brief_tickets (
  plan_id uuid PRIMARY KEY REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.ai_employee_brief_tickets FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.ai_employee_brief_tickets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.guard_social_media_plan_brief_pic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF NEW.brief IS NOT DISTINCT FROM OLD.brief THEN
    RETURN NEW;
  END IF;

  IF public.is_plan_pic(OLD.id) THEN
    RETURN NEW;
  END IF;

  v_token := current_setting('ai_employee.brief_write', true);
  IF v_token IS NOT NULL AND v_token <> '' THEN
    DELETE FROM public.ai_employee_brief_tickets
    WHERE plan_id = OLD.id
      AND token = v_token;

    IF FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Only the PIC can edit brief content'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_social_media_plan_brief_pic() FROM PUBLIC, anon, authenticated, service_role;
