-- Product rows follow the catalog category. Thinking rows carry their angle id
-- so an ad-hoc task can stay inside the brief's angle focus.

DO $patch$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_context(uuid, uuid, text, jsonb)'::regprocedure),
    E'\r\n',
    E'\n'
  );
  old_product text := $old$        AND (
          knowledge.service_id = ANY (COALESCE(brief.service_ids, '{}'))
          OR sub.service_id = ANY (COALESCE(brief.service_ids, '{}'))
        )
        AND (
          COALESCE(cardinality(brief.product_knowledge_ids), 0) = 0
          OR knowledge.id = ANY (brief.product_knowledge_ids)
        )$old$;
  new_product text := $new$        AND knowledge.service_id = ANY (COALESCE(brief.service_ids, '{}'))
        AND (
          COALESCE(cardinality(brief.product_knowledge_ids), 0) = 0
          OR knowledge.id = ANY (brief.product_knowledge_ids)
        )$new$;
  old_limit text := $old$        knowledge.updated_at DESC,
        knowledge.id
      LIMIT 6
    ) x;
  ELSIF p_scope = 'carousel_paths' THEN$old$;
  new_limit text := $new$        knowledge.updated_at DESC,
        knowledge.id
      LIMIT 30
    ) x;
  ELSIF p_scope = 'carousel_paths' THEN$new$;
  old_idea text := $old$      SELECT idea.id AS idea_id,
             left(btrim(idea.statement), 500) AS idea_statement,$old$;
  new_idea text := $new$      SELECT idea.id AS idea_id,
             angle.id AS angle_id,
             left(btrim(idea.statement), 500) AS idea_statement,$new$;
BEGIN
  IF position(old_product IN def) = 0
    OR position(old_limit IN def) = 0
    OR position(old_idea IN def) = 0
  THEN
    RAISE EXCEPTION 'focused product snippet missing';
  END IF;
  def := replace(def, old_product, new_product);
  def := replace(def, old_limit, new_limit);
  def := replace(def, old_idea, new_idea);
  EXECUTE def;
END;
$patch$;
