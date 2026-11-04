-- Replace carousel JPGs in one transaction so the 10-image limit
-- does not reject the new pages while the old pages are still stored.

CREATE OR REPLACE FUNCTION public.canva_carousel_replace_images(
  p_plan_id uuid,
  p_paths text[]
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_paths text[];
BEGIN
  IF coalesce(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_plan_id IS NULL
    OR p_paths IS NULL
    OR cardinality(p_paths) < 1
    OR cardinality(p_paths) > 10
    OR EXISTS (
      SELECT 1
      FROM unnest(p_paths) AS path
      WHERE path IS NULL
        OR btrim(path) = ''
        OR path LIKE '%..%'
        OR split_part(path, '/', 2) IS DISTINCT FROM p_plan_id::text
    )
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(storage_path), ARRAY[]::text[])
  INTO old_paths
  FROM public.social_media_plan_carousel_images
  WHERE social_media_plan_id = p_plan_id;

  DELETE FROM public.social_media_plan_carousel_images
  WHERE social_media_plan_id = p_plan_id;

  INSERT INTO public.social_media_plan_carousel_images (
    social_media_plan_id,
    sort_order,
    storage_path
  )
  SELECT p_plan_id, (ordinality - 1)::integer, path
  FROM unnest(p_paths) WITH ORDINALITY AS slide(path, ordinality);

  RETURN old_paths;
END;
$$;

REVOKE ALL ON FUNCTION public.canva_carousel_replace_images(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.canva_carousel_replace_images(uuid, text[]) TO service_role;
