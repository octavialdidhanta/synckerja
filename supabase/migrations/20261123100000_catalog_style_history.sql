-- Gaya baku history: every change to a style box keeps the version it replaced,
-- so the owner can look back and restore an older version (step 9 of the Katalog task).
-- Office edits and Claude's MCP edits both go through the trigger. Members can only read.
-- The last 50 versions per box are kept.

CREATE TABLE public.catalog_style_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  field_key text NOT NULL,
  body text NOT NULL,
  replaced_at timestamptz NOT NULL DEFAULT now(),
  replaced_by uuid
);

COMMENT ON TABLE public.catalog_style_history IS
  'Previous versions of catalog_style_fields.body, written by trigger. body is the text that was replaced at replaced_at.';
COMMENT ON COLUMN public.catalog_style_history.replaced_by IS
  'auth.uid() of the Office user who saved the newer version; null when it came from MCP or a script.';

CREATE INDEX catalog_style_history_org_key_idx
  ON public.catalog_style_history (organization_id, field_key, replaced_at DESC);

ALTER TABLE public.catalog_style_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_style_history_select ON public.catalog_style_history
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

REVOKE ALL ON TABLE public.catalog_style_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.catalog_style_history TO authenticated;
GRANT ALL ON TABLE public.catalog_style_history TO service_role;

CREATE OR REPLACE FUNCTION public.catalog_style_history_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $capture$
BEGIN
  INSERT INTO public.catalog_style_history (organization_id, field_key, body, replaced_by)
  VALUES (OLD.organization_id, OLD.field_key, OLD.body, auth.uid());

  DELETE FROM public.catalog_style_history h
  WHERE h.organization_id = OLD.organization_id
    AND h.field_key = OLD.field_key
    AND h.id NOT IN (
      SELECT k.id
      FROM public.catalog_style_history k
      WHERE k.organization_id = OLD.organization_id
        AND k.field_key = OLD.field_key
      ORDER BY k.replaced_at DESC, k.id DESC
      LIMIT 50
    );
  RETURN NEW;
END;
$capture$;

REVOKE ALL ON FUNCTION public.catalog_style_history_capture() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER catalog_style_fields_history
  AFTER UPDATE OF body ON public.catalog_style_fields
  FOR EACH ROW
  WHEN (OLD.body IS DISTINCT FROM NEW.body)
  EXECUTE FUNCTION public.catalog_style_history_capture();
