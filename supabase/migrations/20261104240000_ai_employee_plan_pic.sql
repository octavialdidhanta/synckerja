-- Karyawan AI yang menulis plan juga menjadi PIC.
-- Karyawan manusia tidak diubah di sini: PIC manusia tetap diisi dari profil aktif di aplikasi.

DO $patch$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_perform(uuid, uuid, text, jsonb)'::regprocedure),
    E'\r\n',
    E'\n'
  );
  old_insert text := $old$    INSERT INTO public.social_media_plans (
      organization_id, title, brief, post_date, content_pillar_id, service_id, thinking_idea_id,
      product_knowledge_id, product_knowledge_fields, author_employee_id, content_type_id,
      production_status, approved, production_approved, status
    ) VALUES (
      v_org, v_title, v_brief, v_post, v_pillar, v_service, v_idea,
      v_product, v_fields, p_employee_id, v_carousel_type, 'Need Review', false, false, 'draft'
    )$old$;
  new_insert text := $new$    INSERT INTO public.social_media_plans (
      organization_id, title, brief, post_date, content_pillar_id, service_id, thinking_idea_id,
      product_knowledge_id, product_knowledge_fields, author_employee_id, content_type_id, pic_id,
      production_status, approved, production_approved, status
    ) VALUES (
      v_org, v_title, v_brief, v_post, v_pillar, v_service, v_idea,
      v_product, v_fields, p_employee_id, v_carousel_type,
      (SELECT ai_author.id
         FROM public.employees ai_author
        WHERE ai_author.id = p_employee_id
          AND ai_author.organization_id = v_org
          AND ai_author.is_ai IS TRUE),
      'Need Review', false, false, 'draft'
    )$new$;
BEGIN
  IF position(old_insert IN def) = 0 THEN
    RAISE EXCEPTION 'ai_employee_plan_pic_insert_not_found';
  END IF;
  EXECUTE replace(def, old_insert, new_insert);

  UPDATE public.social_media_plans plan
  SET pic_id = plan.author_employee_id
  FROM public.employees ai_author
  WHERE plan.author_employee_id = ai_author.id
    AND ai_author.is_ai IS TRUE
    AND plan.pic_id IS NULL;
END;
$patch$;
