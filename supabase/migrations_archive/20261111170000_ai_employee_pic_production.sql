-- Karyawan AI yang menjadi PIC content plan juga menjadi PIC Production.
-- Penugasan langkah konten tetap bisa menggantinya nanti.

DO $patch$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_perform(uuid, uuid, text, jsonb)'::regprocedure),
    E'\r\n',
    E'\n'
  );
  old_insert text := $old$    INSERT INTO public.social_media_plans (
      organization_id, title, brief, post_date, content_pillar_id, service_id, thinking_idea_id,
      product_knowledge_id, product_knowledge_fields, author_employee_id, content_type_id, pic_id,
      delivery_voice, production_status, approved, production_approved, status
    ) VALUES (
      v_org, v_title, v_brief, v_post, v_pillar, v_service, v_idea,
      v_product, v_fields, p_employee_id, v_carousel_type,
      (SELECT ai_author.id
         FROM public.employees ai_author
        WHERE ai_author.id = p_employee_id
          AND ai_author.organization_id = v_org
          AND ai_author.is_ai IS TRUE),
      CASE WHEN NULLIF(v_payload->>'path_pillar_id', '') IS NOT NULL THEN v_delivery_voice ELSE NULL END,
      NULL, false, false, 'Need Review'
    )$old$;
  new_insert text := $new$    INSERT INTO public.social_media_plans (
      organization_id, title, brief, post_date, content_pillar_id, service_id, thinking_idea_id,
      product_knowledge_id, product_knowledge_fields, author_employee_id, content_type_id, pic_id,
      delivery_voice, pic_production_id, pic_production_source, production_status, approved, production_approved, status
    ) VALUES (
      v_org, v_title, v_brief, v_post, v_pillar, v_service, v_idea,
      v_product, v_fields, p_employee_id, v_carousel_type,
      (SELECT ai_author.id
         FROM public.employees ai_author
        WHERE ai_author.id = p_employee_id
          AND ai_author.organization_id = v_org
          AND ai_author.is_ai IS TRUE),
      CASE WHEN NULLIF(v_payload->>'path_pillar_id', '') IS NOT NULL THEN v_delivery_voice ELSE NULL END,
      (SELECT ai_author.id
         FROM public.employees ai_author
        WHERE ai_author.id = p_employee_id
          AND ai_author.organization_id = v_org
          AND ai_author.is_ai IS TRUE),
      CASE
        WHEN EXISTS (
          SELECT 1
            FROM public.employees ai_author
           WHERE ai_author.id = p_employee_id
             AND ai_author.organization_id = v_org
             AND ai_author.is_ai IS TRUE
        ) THEN 'content_pic'
        ELSE NULL
      END,
      NULL, false, false, 'Need Review'
    )$new$;
BEGIN
  IF position(old_insert IN def) = 0 THEN
    RAISE EXCEPTION 'ai_employee_pic_production_insert_not_found';
  END IF;
  EXECUTE replace(def, old_insert, new_insert);

  UPDATE public.social_media_plans plan
  SET pic_production_id = plan.pic_id,
      pic_production_source = 'content_pic'
  FROM public.employees pic
  WHERE plan.pic_id = pic.id
    AND pic.is_ai IS TRUE
    AND plan.pic_production_id IS NULL;
END;
$patch$;
