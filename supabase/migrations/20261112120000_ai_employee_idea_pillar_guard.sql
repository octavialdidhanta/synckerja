-- An idea may return with a different pillar. The same idea and pillar stay unique.

DO $guard$
DECLARE
  def text := pg_get_functiondef('public.ai_employee_perform(uuid, uuid, text, jsonb)'::regprocedure);
  old_guard text := $old$      ELSIF EXISTS (
        SELECT 1 FROM public.social_media_plans existing
        WHERE existing.organization_id = v_org
          AND existing.thinking_idea_id = v_idea
      ) THEN
        RAISE EXCEPTION 'idea_used' USING ERRCODE = '23505';
      END IF;$old$;
  new_guard text := $new$      ELSIF EXISTS (
        SELECT 1 FROM public.social_media_plans existing
        WHERE existing.organization_id = v_org
          AND existing.thinking_idea_id = v_idea
          AND existing.content_pillar_id = v_pillar
      ) THEN
        RAISE EXCEPTION 'idea_used' USING ERRCODE = '23505';
      END IF;$new$;
BEGIN
  IF position(new_guard IN def) > 0 THEN
    RETURN;
  END IF;
  IF position(old_guard IN def) = 0 THEN
    RAISE EXCEPTION 'ai_employee_perform_idea_guard_missing';
  END IF;
  EXECUTE replace(def, old_guard, new_guard);
END;
$guard$;
