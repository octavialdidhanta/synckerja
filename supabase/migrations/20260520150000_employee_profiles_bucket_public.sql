-- Ensure employee-profiles bucket is public (required for /storage/v1/object/public/... URLs).
UPDATE storage.buckets
SET public = true
WHERE id = 'employee-profiles';

-- Align stale employees.profile_photo_url with profiles when profiles has the canonical URL.
UPDATE public.employees e
SET
  profile_photo_url = p.profile_photo_url,
  updated_at = now()
FROM public.profiles p
WHERE e.user_id = p.user_id
  AND p.profile_photo_url IS NOT NULL
  AND trim(p.profile_photo_url) <> ''
  AND (
    e.profile_photo_url IS NULL
    OR trim(e.profile_photo_url) = ''
    OR e.profile_photo_url IS DISTINCT FROM p.profile_photo_url
  );
