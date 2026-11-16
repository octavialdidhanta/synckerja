-- Brief flag: run SOP1 execution check (10 points) before plan save. Default ON.

ALTER TABLE public.ai_employee_briefs
  ADD COLUMN IF NOT EXISTS execution_check_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.ai_employee_briefs.execution_check_enabled IS
  'When true, SOP1 judges the draft with the 10-point execution check before plan save. When false, that step is skipped; hard parse gates still apply.';

-- brief_payload: expose execution_check_enabled
DO $payload$
DECLARE
  def text := pg_get_functiondef('public.ai_employee_brief_payload(uuid)'::regprocedure);
  old_hooks text := $old$'use_system_hooks', COALESCE(v_row.use_system_hooks, true),$old$;
  new_hooks text := $new$'use_system_hooks', COALESCE(v_row.use_system_hooks, true),
    'execution_check_enabled', COALESCE(v_row.execution_check_enabled, true),$new$;
  old_empty_hooks text := $old$'use_system_hooks', true,$old$;
  new_empty_hooks text := $new$'use_system_hooks', true,
      'execution_check_enabled', true,$new$;
BEGIN
  IF position('''execution_check_enabled'', COALESCE(v_row.execution_check_enabled' IN def) > 0 THEN
    RETURN;
  END IF;
  IF position(old_hooks IN def) = 0 THEN
    RAISE EXCEPTION 'ai_employee_brief_payload_execution_check_snippet_missing';
  END IF;
  def := replace(def, old_hooks, new_hooks);
  IF position(old_empty_hooks IN def) > 0
     AND position('''execution_check_enabled'', true' IN def) = 0 THEN
    def := replace(def, old_empty_hooks, new_empty_hooks);
  END IF;
  EXECUTE def;
END;
$payload$;

-- brief_write: optional execution_check_enabled from payload
DO $write$
DECLARE
  def text := pg_get_functiondef('public.ai_employee_brief_write(uuid, uuid, uuid, jsonb)'::regprocedure);
  old_declare text := 'v_sub uuid; v_subs uuid[]; v_auto boolean; v_hooks boolean; v_has_sub boolean; v_has_auto boolean; v_has_hooks boolean;';
  new_declare text := 'v_sub uuid; v_subs uuid[]; v_auto boolean; v_hooks boolean; v_exec_check boolean; v_has_sub boolean; v_has_auto boolean; v_has_hooks boolean; v_has_exec_check boolean;';
  old_parse_tail text := $old$IF v_has_hooks AND v_hooks IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;$old$;
  new_parse_tail text := $new$IF v_has_hooks AND v_hooks IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_has_exec_check := p_brief ? 'execution_check_enabled';
  v_exec_check := CASE
    WHEN NOT v_has_exec_check THEN true
    WHEN jsonb_typeof(p_brief->'execution_check_enabled') = 'boolean' THEN (p_brief->>'execution_check_enabled')::boolean
    ELSE NULL
  END;
  IF v_has_exec_check AND v_exec_check IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;$new$;
  old_insert text := 'content_plan_auto_approve, use_system_hooks, updated_at) VALUES (p_employee_id, p_organization_id, v_services, v_audience, v_personas, v_voice, v_required, v_forbidden, v_pillars, v_products, v_angles, v_voices, v_split, v_sub, v_subs, COALESCE(v_auto, false), COALESCE(v_hooks, true), now())';
  new_insert text := 'content_plan_auto_approve, use_system_hooks, execution_check_enabled, updated_at) VALUES (p_employee_id, p_organization_id, v_services, v_audience, v_personas, v_voice, v_required, v_forbidden, v_pillars, v_products, v_angles, v_voices, v_split, v_sub, v_subs, COALESCE(v_auto, false), COALESCE(v_hooks, true), COALESCE(v_exec_check, true), now())';
  old_conflict text := $old$use_system_hooks = CASE
        WHEN v_has_hooks THEN EXCLUDED.use_system_hooks
        ELSE ai_employee_briefs.use_system_hooks
      END,$old$;
  new_conflict text := $new$use_system_hooks = CASE
        WHEN v_has_hooks THEN EXCLUDED.use_system_hooks
        ELSE ai_employee_briefs.use_system_hooks
      END,
      execution_check_enabled = CASE
        WHEN v_has_exec_check THEN EXCLUDED.execution_check_enabled
        ELSE ai_employee_briefs.execution_check_enabled
      END,$new$;
BEGIN
  IF position('v_has_exec_check boolean' IN def) > 0 THEN
    RETURN;
  END IF;
  IF position(old_declare IN def) = 0
    OR position(old_parse_tail IN def) = 0
    OR position(old_insert IN def) = 0
    OR position(old_conflict IN def) = 0 THEN
    RAISE EXCEPTION 'ai_employee_brief_write_execution_check_snippet_missing';
  END IF;
  def := replace(def, old_declare, new_declare);
  def := replace(def, old_parse_tail, new_parse_tail);
  def := replace(def, old_insert, new_insert);
  def := replace(def, old_conflict, new_conflict);
  EXECUTE def;
END;
$write$;

-- thinking.plan.save: carousel slides may omit execution_id when brief skips quality check
DO $perform$
DECLARE
  def text := pg_get_functiondef('public.ai_employee_perform(uuid, uuid, text, jsonb)'::regprocedure);
  old_carousel text := $old$ELSIF jsonb_typeof(v_payload->'slides') = 'array' THEN
      IF p_action <> 'thinking.plan.save' OR v_execution IS NULL THEN
        RAISE EXCEPTION 'execution_not_passed' USING ERRCODE = '42501';
      END IF;$old$;
  new_carousel text := $new$ELSIF jsonb_typeof(v_payload->'slides') = 'array' THEN
      IF p_action <> 'thinking.plan.save' THEN
        RAISE EXCEPTION 'execution_not_passed' USING ERRCODE = '42501';
      END IF;$new$;
BEGIN
  IF position(old_carousel IN def) = 0 THEN
    IF position($ok$ELSIF jsonb_typeof(v_payload->'slides') = 'array' THEN
      IF p_action <> 'thinking.plan.save' THEN
        RAISE EXCEPTION 'execution_not_passed' USING ERRCODE = '42501';
      END IF;$ok$ IN def) > 0 THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'ai_employee_perform_carousel_execution_optional_snippet_missing';
  END IF;
  def := replace(def, old_carousel, new_carousel);
  EXECUTE def;
END;
$perform$;
