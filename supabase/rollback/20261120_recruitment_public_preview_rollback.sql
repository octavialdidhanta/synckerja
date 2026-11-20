-- Rollback for 20261120110000_recruitment_public_preview_rpc.sql (restores the previous policies).
ALTER POLICY recruitment_links_select ON public.recruitment_links
  TO anon, authenticated
  USING ((organization_id IN (SELECT public.user_organization_ids()))
         OR ((status = 'active') AND ((expires_at IS NULL) OR (expires_at > now()))));

ALTER POLICY job_openings_select ON public.job_openings
  TO anon, authenticated
  USING ((organization_id IN (SELECT public.user_organization_ids()))
         OR (EXISTS (SELECT 1 FROM public.recruitment_links rl
                     WHERE rl.job_opening_id = job_openings.id AND rl.status = 'active'
                       AND (rl.expires_at IS NULL OR rl.expires_at > now()))));

ALTER POLICY question_review_select_auth ON public.question_review
  USING (COALESCE(is_active, true));

DROP FUNCTION IF EXISTS public.get_job_by_recruitment_token(text);
