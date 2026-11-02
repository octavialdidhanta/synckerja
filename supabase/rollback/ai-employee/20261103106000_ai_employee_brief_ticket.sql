-- Rollback 20261103106000_ai_employee_brief_ticket.sql
-- Kembalikan penjaga brief ke perilaku PIC semula, lalu hapus tiket.

CREATE OR REPLACE FUNCTION public.guard_social_media_plan_brief_pic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.brief IS DISTINCT FROM OLD.brief AND NOT public.is_plan_pic(OLD.id) THEN
    RAISE EXCEPTION 'Only the PIC can edit brief content'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_social_media_plan_brief_pic() FROM PUBLIC;

DROP TABLE IF EXISTS public.ai_employee_brief_tickets;
