-- Owner could not see other members: the function ran as the caller and
-- profiles_select_own hid every profile except their own.

CREATE OR REPLACE FUNCTION public.get_organization_members(_organization_id uuid)
RETURNS TABLE (user_id uuid, full_name text, email text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      uo.user_id AS uid,
      COALESCE(p.full_name, e.full_name, p.email, '')::text AS fn,
      p.email::text AS em,
      ur.role::text AS r,
      CASE lower(ur.role::text)
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'manager' THEN 3
        WHEN 'member' THEN 4
        ELSE 5
      END AS rk
    FROM public.user_organizations uo
    JOIN public.profiles p ON p.user_id = uo.user_id
    LEFT JOIN public.employees e
      ON e.user_id = uo.user_id
      AND e.organization_id = uo.organization_id
    JOIN public.user_roles ur
      ON ur.user_id = uo.user_id
      AND ur.organization_id = uo.organization_id
    WHERE uo.organization_id = _organization_id
      AND COALESCE(uo.is_active, true) = true
      AND EXISTS (
        SELECT 1
        FROM public.user_organizations me
        WHERE me.user_id = (SELECT auth.uid())
          AND me.organization_id = _organization_id
          AND COALESCE(me.is_active, true) = true
      )
  ),
  best AS (
    SELECT DISTINCT ON (ranked.uid)
      ranked.uid,
      ranked.fn,
      ranked.em,
      ranked.r
    FROM ranked
    ORDER BY ranked.uid, ranked.rk ASC
  )
  SELECT best.uid, best.fn, best.em, best.r FROM best;
$$;

REVOKE ALL ON FUNCTION public.get_organization_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_organization_members(uuid) TO authenticated;
