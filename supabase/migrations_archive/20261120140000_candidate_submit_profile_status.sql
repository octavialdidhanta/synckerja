-- candidate_submit_profile: confirm the application from any open status.
-- Pipeline: pending -> reviewed -> scheduled -> contacted -> confirmed -> accepted | rejected.
-- The first version only moved pending/submitted/interview/scheduled, so a candidate whose
-- application was already "reviewed" or "contacted" stayed there after submitting the profile.
CREATE OR REPLACE FUNCTION public.candidate_submit_profile(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n int;
BEGIN
  IF p_token IS NULL OR p_token !~ '^cand_[0-9a-f]{48}$' THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.candidate_profiles
     SET profile_completed = true, submitted_at = now()
   WHERE recruitment_token = p_token;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.job_applications SET status = 'confirmed'
   WHERE recruitment_token = p_token
     AND coalesce(status, 'pending') NOT IN ('confirmed', 'accepted', 'rejected');
  RETURN true;
END;
$$;
