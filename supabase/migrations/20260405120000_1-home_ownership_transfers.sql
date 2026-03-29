-- Transfer ownership: profiles.full_name, ownership_transfers table, RLS, RPCs

-- 1) profiles.display name for member lists / transfers
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

-- 2) ownership_transfers
CREATE TABLE IF NOT EXISTS public.ownership_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  message text NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ownership_transfers_status_check CHECK (status = ANY (ARRAY['pending'::text, 'cancelled'::text, 'completed'::text]))
);

CREATE INDEX IF NOT EXISTS idx_ownership_transfers_org_status
  ON public.ownership_transfers (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_ownership_transfers_from_user
  ON public.ownership_transfers (from_user_id);

CREATE INDEX IF NOT EXISTS idx_ownership_transfers_to_user
  ON public.ownership_transfers (to_user_id);

DROP TRIGGER IF EXISTS update_ownership_transfers_updated_at ON public.ownership_transfers;
CREATE TRIGGER update_ownership_transfers_updated_at
  BEFORE UPDATE ON public.ownership_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ownership_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ownership_transfers_select_parties" ON public.ownership_transfers;
CREATE POLICY "ownership_transfers_select_parties"
  ON public.ownership_transfers FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = from_user_id
    OR (SELECT auth.uid()) = to_user_id
  );

DROP POLICY IF EXISTS "ownership_transfers_update_parties" ON public.ownership_transfers;
CREATE POLICY "ownership_transfers_update_parties"
  ON public.ownership_transfers FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = from_user_id
    OR (SELECT auth.uid()) = to_user_id
  )
  WITH CHECK (
    (SELECT auth.uid()) = from_user_id
    OR (SELECT auth.uid()) = to_user_id
  );

-- 3) get_organization_members (one row per user, highest privilege role)
CREATE OR REPLACE FUNCTION public.get_organization_members(_organization_id uuid)
RETURNS TABLE (user_id uuid, full_name text, email text, role text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      uo.user_id AS uid,
      COALESCE(p.full_name, e.full_name, p.email, '')::text AS fn,
      p.email::text AS em,
      ur.role::text AS r,
      CASE lower(ur.role)
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'manager' THEN 3
        WHEN 'member' THEN 4
        ELSE 5
      END AS rk
    FROM public.user_organizations uo
    JOIN public.profiles p ON p.user_id = uo.user_id
    LEFT JOIN public.employees e ON e.user_id = uo.user_id
    JOIN public.user_roles ur ON ur.user_id = uo.user_id AND ur.organization_id = uo.organization_id
    WHERE uo.organization_id = _organization_id
      AND COALESCE(uo.is_active, true) = true
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

GRANT EXECUTE ON FUNCTION public.get_organization_members(uuid) TO authenticated;

-- 4) transfer_ownership
CREATE OR REPLACE FUNCTION public.transfer_ownership(_to_user_id uuid, _message text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  org_id uuid;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT p.active_organization_id INTO org_id
  FROM public.profiles p
  WHERE p.user_id = uid;

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'no active organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = uid
      AND ur.organization_id = org_id
      AND lower(ur.role) = 'owner'
  ) THEN
    RAISE EXCEPTION 'only organization owner can start a transfer';
  END IF;

  IF _to_user_id = uid THEN
    RAISE EXCEPTION 'cannot transfer ownership to yourself';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = _to_user_id
      AND uo.organization_id = org_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'target user is not an active member of this organization';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ownership_transfers ot
    WHERE ot.from_user_id = uid
      AND ot.organization_id = org_id
      AND ot.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'a pending transfer request already exists for this organization';
  END IF;

  INSERT INTO public.ownership_transfers (from_user_id, to_user_id, organization_id, message, status)
  VALUES (uid, _to_user_id, org_id, _message, 'pending')
  RETURNING id INTO new_id;

  RETURN new_id::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_ownership(uuid, text) TO authenticated;

-- 5) accept_ownership_transfer
CREATE OR REPLACE FUNCTION public.accept_ownership_transfer(_transfer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rec public.ownership_transfers%ROWTYPE;
  updated_rows integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO rec
  FROM public.ownership_transfers
  WHERE id = _transfer_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer not found or not pending';
  END IF;

  IF rec.to_user_id <> uid THEN
    RAISE EXCEPTION 'only the invited user can accept this transfer';
  END IF;

  UPDATE public.user_roles ur
  SET role = 'admin', updated_at = now()
  WHERE ur.organization_id = rec.organization_id
    AND ur.user_id = rec.from_user_id
    AND lower(ur.role) = 'owner';

  UPDATE public.user_roles ur
  SET role = 'owner', updated_at = now()
  WHERE ur.organization_id = rec.organization_id
    AND ur.user_id = rec.to_user_id;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  IF updated_rows = 0 THEN
    INSERT INTO public.user_roles (user_id, organization_id, role)
    VALUES (rec.to_user_id, rec.organization_id, 'owner');
  END IF;

  UPDATE public.organizations o
  SET user_id = rec.to_user_id,
      updated_at = now()
  WHERE o.id = rec.organization_id;

  UPDATE public.ownership_transfers ot
  SET status = 'completed', updated_at = now()
  WHERE ot.id = _transfer_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_ownership_transfer(uuid) TO authenticated;
