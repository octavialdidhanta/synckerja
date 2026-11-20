-- Public job preview by recruitment token + close cross-tenant reads.
--
-- 1. get_job_by_recruitment_token(token): SECURITY DEFINER RPC used by /apply/preview/:token and
--    /candidate/apply. Returns one active, unexpired link with its job, company and lookup names
--    (same shape as the old client-side fallback query) plus required skills. Callable by anon.
--    Before this, the RPC did not exist and the fallback failed for anon
--    ("permission denied for function user_organization_ids"), so candidates saw "Job not found".
-- 2. recruitment_links / job_openings SELECT: members of the organization only. Previously any
--    signed-in user of any organization could list every active link (token included) and job.
-- 3. question_review SELECT: global rows (organization_id IS NULL) or own organization only.
--
-- Rollback: supabase/rollback/20261120_recruitment_public_preview_rollback.sql

CREATE OR REPLACE FUNCTION public.get_job_by_recruitment_token(token_param text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT to_jsonb(rl) - 'created_by'
         || jsonb_build_object(
              'job_openings',
              to_jsonb(jo) - 'created_by'
              || jsonb_build_object(
                   'organizations', (SELECT jsonb_build_object('company_name', o.company_name, 'industry', o.industry,
                                                               'address', o.address, 'website', o.website,
                                                               'description', o.description)
                                     FROM public.organizations o WHERE o.id = jo.organization_id),
                   'departments', (SELECT jsonb_build_object('name', d.name) FROM public.departments d WHERE d.id = jo.department_id),
                   'job_positions', (SELECT jsonb_build_object('name', p.name) FROM public.job_positions p WHERE p.id = jo.job_position_id),
                   'job_levels', (SELECT jsonb_build_object('name', l.name) FROM public.job_levels l WHERE l.id = jo.job_level_id),
                   'employee_statuses', (SELECT jsonb_build_object('name', s.name) FROM public.employee_statuses s WHERE s.id = jo.employment_status_id)
                 ),
              'required_skills',
              coalesce((SELECT jsonb_agg(jsonb_build_object('title', rs.title, 'skill_level', rs.skill_level,
                                                            'is_required', rs.is_required, 'description', rs.description)
                                         ORDER BY rs.is_required DESC NULLS LAST, rs.title)
                        FROM public.recruitment_skills rs WHERE rs.job_opening_id = jo.id), '[]'::jsonb)
            )
  FROM public.recruitment_links rl
  JOIN public.job_openings jo ON jo.id = rl.job_opening_id
  WHERE token_param IS NOT NULL
    AND length(token_param) BETWEEN 8 AND 200
    AND rl.token = token_param
    AND rl.status = 'active'
    AND (rl.expires_at IS NULL OR rl.expires_at > now())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_job_by_recruitment_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_job_by_recruitment_token(text) TO anon, authenticated, service_role;

ALTER POLICY recruitment_links_select ON public.recruitment_links
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

ALTER POLICY job_openings_select ON public.job_openings
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

ALTER POLICY question_review_select_auth ON public.question_review
  USING (COALESCE(is_active, true)
         AND (organization_id IS NULL OR organization_id IN (SELECT public.user_organization_ids())));
