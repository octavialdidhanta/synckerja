-- Admin dashboard reads organizations.email. Ownership transfer changed the owner
-- but left the previous owner's address on the organization row.

UPDATE public.organizations o
SET email = p.email,
    updated_at = now()
FROM public.profiles p
WHERE p.user_id = o.user_id
  AND NULLIF(btrim(p.email), '') IS NOT NULL
  AND lower(btrim(coalesce(o.email, ''))) IS DISTINCT FROM lower(btrim(p.email))
  AND EXISTS (
    SELECT 1
    FROM public.profiles previous_owner
    WHERE lower(btrim(previous_owner.email)) = lower(btrim(o.email))
      AND previous_owner.user_id <> o.user_id
  );

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
      email = COALESCE(
        (
          SELECT NULLIF(btrim(p.email), '')
          FROM public.profiles p
          WHERE p.user_id = rec.to_user_id
        ),
        o.email
      ),
      updated_at = now()
  WHERE o.id = rec.organization_id;

  UPDATE public.employees e
  SET manager_id = NULL
  WHERE e.organization_id = rec.organization_id
    AND e.user_id = rec.to_user_id
    AND e.manager_id IS NOT NULL;

  UPDATE public.ownership_transfers ot
  SET status = 'completed', updated_at = now()
  WHERE ot.id = _transfer_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_ownership_transfer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_ownership_transfer(uuid) TO authenticated;
