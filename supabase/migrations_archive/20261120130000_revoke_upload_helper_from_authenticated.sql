-- recruitment_public_upload_allowed() is only used by the anon storage insert policy.
-- Default privileges also granted it to `authenticated`; remove that (Security Advisor 0029).
REVOKE EXECUTE ON FUNCTION public.recruitment_public_upload_allowed(text) FROM authenticated;
