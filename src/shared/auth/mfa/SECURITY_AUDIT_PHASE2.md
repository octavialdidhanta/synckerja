# MFA Security Audit — Phase 2 Hardening

Phase 1 (client) adds `RequireMfaSession` on all routes under `RequireAuth`, blocking UI navigation until AAL2 when TOTP is enrolled.

**Client guards are not sufficient alone.** AAL1 JWTs remain valid for PostgREST and most edge functions until expiry.

## Closed by Phase 1

| Finding | Mitigation |
|---------|------------|
| Manual navigation to `/` while on `/login/mfa` | `RequireMfaSession` redirects to `/login/mfa?redirectTo=...` |
| Dashboard flash before MFA | `AuthResolvingShell` + `AppRoutesSuspenseFallback` skips home skeleton when MFA pending |
| Login page with existing AAL1 session | `LoginScreen` calls `resolvePostAuthRouting` on mount |

## Remaining risks (prioritized)

### High — PostgREST / RLS without AAL check

- **Risk:** User with enrolled TOTP but AAL1 session can call `supabase.from(...)` directly (devtools, Postman) for any table allowed by RLS.
- **Mitigation:** Selective RLS policies on high-risk tables using `(auth.jwt() ->> 'aal') = 'aal2'` OR user has no verified TOTP factor (RPC `security definer` to check enrollment).
- **Candidate tables:** `xendit_*`, payroll disbursement, ownership transfer, `user_mfa_recovery_codes` (already own-row scoped).

### High — Edge functions auth-only

- **Risk:** ~50+ functions use `auth.getUser()` without `requireAal2FromBearer`.
- **Mitigation:** Extend `supabase/functions/_shared/auth/requireAal2.ts` into a shared `requireAuthUser({ requireAal2?: boolean })` helper.
- **Priority functions:**
  - `xendit-api` — extend AAL2 to **all** reads (`getSettings`, balance) for MFA-enrolled users
  - `brick-*`, payroll/disbursement edges
  - `create-user`, `generate-magic-link`, transfer-ownership flows

### Medium — Xendit read at AAL1

- **Risk:** `getSettings`, wallet sync readable at AAL1; only mutations require AAL2 today.
- **Mitigation:** Align read + write AAL2 policy for enrolled MFA users in `xendit-api/index.ts`.

### Medium — `MfaRequiredGuard` grace period

- **Risk:** Owner/Admin without TOTP can browse `/xendit` UI for 14 days (`localStorage` grace).
- **Note:** Enrollment guard, not session MFA. Grace is client-side and manipulable.
- **Mitigation:** Shorten grace, server-side enrollment flag, or block reads until enrolled.

### Low — Step-up vs session gate

- `MfaStepUpProvider` / `ensureAal2()` covers sensitive **actions** only (withdraw, password change). Correct UX complement, not a substitute for `RequireMfaSession`.

## Guard naming (do not confuse)

| Component | Purpose |
|-----------|---------|
| `RequireMfaSession` | Login session MFA — block app until AAL2 when TOTP enrolled |
| `MfaRequiredGuard` | Owner/Admin **enrollment** before `/xendit` (14-day grace) |
| `MfaStepUpProvider` | In-session step-up for individual mutations |

## Phase 3 (optional)

- Supabase Custom Access Token Hook to restrict AAL1 token scope.
- Log `mfa_bypass_attempt` via `log_auth_security_event` when `RequireMfaSession` redirects (detect probing).

## Verification checklist (Phase 1 QA)

- [ ] Login + TOTP → `/login/mfa` → type `/` → stays on MFA or redirects back
- [ ] After MFA verify → `/` works; refresh persists
- [ ] User without TOTP → no `/login/mfa`; direct app access
- [ ] Recovery unenroll → `/settings` accessible (no TOTP → no challenge)
- [ ] Desktop, mobile web, native Capacitor — same route tree in `App.tsx`
