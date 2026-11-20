-- Fokus angle in the AI employee brief: up to 6 angles instead of 3, so newly locked
-- angles (e.g. "Suasana restoran") can join without dropping an older one.

ALTER TABLE public.ai_employee_briefs
  DROP CONSTRAINT IF EXISTS ai_employee_briefs_text_length;

ALTER TABLE public.ai_employee_briefs
  ADD CONSTRAINT ai_employee_briefs_text_length CHECK (
    char_length(audience) <= 1000
    AND char_length(voice) <= 1000
    AND char_length(required_notes) <= 2000
    AND char_length(forbidden_notes) <= 2000
    AND char_length(split_rule) <= 1000
    AND cardinality(service_ids) <= 12
    AND cardinality(persona_ids) <= 12
    AND cardinality(pillar_ids) <= 12
    AND cardinality(product_knowledge_ids) <= 12
    AND cardinality(angle_ids) <= 6
    AND cardinality(repeat_voices) <= 3
  );

DO $limit$
DECLARE
  def text := pg_get_functiondef('public.ai_employee_brief_write(uuid, uuid, uuid, jsonb)'::regprocedure);
  old_check text := 'cardinality(v_angles) > 3';
  new_check text := 'cardinality(v_angles) > 6';
BEGIN
  IF position(new_check IN def) > 0 THEN
    RETURN;
  END IF;
  IF position(old_check IN def) = 0 THEN
    RAISE EXCEPTION 'ai_employee_brief_write_angle_limit_missing';
  END IF;
  EXECUTE replace(def, old_check, new_check);
END;
$limit$;
