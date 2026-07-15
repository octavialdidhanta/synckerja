-- Staging E2E checklist for CMS hard delete (run manually on branch / dummy org — NOT production).

-- 1) After delete via CMS Zona bahaya:
-- SELECT public.admin_verify_organization_deleted('<organization_id>'::uuid);
-- Expect: is_clean = true, organization_exists = false

-- 2) Exclusive user: cannot sign in after delete (Auth user removed)

-- 3) Multi-org user with deleted active org:
--    - Web: auto-switch to remaining org; header updates
--    - Realtime: refresh within ~2s while online

-- 4) User with zero memberships:
--    - Web: redirect to /organization-unavailable
--    - Mobile ProtectedRoute: same redirect

-- 5) Hard refresh with stale client cache: no infinite skeleton

-- 6) Storage prefix {org_id}/ empty after delete (Edge Function cleanup)

-- 7) Smoke modules post-switch: payroll, attendance, livechat, OKR, finance dashboard
