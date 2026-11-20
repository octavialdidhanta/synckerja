# Supabase Security Advisor — accepted baseline

Last reviewed: 2026-11-20. Use this to tell a **new** warning apart from the ones we keep on purpose.
If the advisor shows something not covered here, investigate it.

## Rule for new database functions

Functions created by `postgres` in schema `public` are **not** callable by `anon` by default
(default privileges give EXECUTE to `authenticated` and `service_role` only).

- Function used by a logged-in page: nothing extra to do.
- Function for a **public** page (no login): add `GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO anon;`
  in the same migration, and make the function validate its token/code itself.
- Function only called by an edge function: `REVOKE EXECUTE ... FROM authenticated;` and keep `service_role`.
- `SECURITY DEFINER` functions must check the caller themselves (`auth.uid()`, org membership, or a token).
  RLS does not protect them.

## Accepted warnings

### 0028 — anon can execute SECURITY DEFINER function (~56)

Kept on purpose. These serve pages used without login, or they are used inside RLS/storage policies.

| Group | Functions |
|---|---|
| Online order (Synckerja Order) | `get_public_synckerja_order_*`, `submit_synckerja_order_*`, `complete_synckerja_order_qris`, `get_public_order_product_*` |
| Review links | `get_public_review_*`, `insert_public_review_comment`, `delete_public_review_comment` |
| Customer survey / receipt feedback | `get_public_customer_survey_form`, `submit_customer_survey`, `get_public_pos_receipt_feedback`, `submit_public_pos_receipt_feedback` |
| Recruitment tests | `cognitive_*`, `disc_*`, `sjt_*`, `increment_recruitment_link_*`, `increment_job_*` |
| Analytics & short links | `analytics_session_touch`, `increment_marketing_short_link_click`, `record_marketing_short_link_visitor` |
| Signup / verification | `email_exists`, `ensure_registration_profile`, `confirm_email_verification_otp` (rate limited), `registration_has_verified_email`, `registration_verify_email_page_allowed` |
| Used in RLS / storage policies | `auth_profile_id`, `is_cms_admin`, `user_is_org_owner_or_admin`, `is_omnichannel_survey_settings_admin`, `candidate_profile_accessible`, `task_step_comment_can_access`, `task_step_comment_can_write`, `task_files_storage_can_write`, `lead_magnet_assets_storage_can_write`, `synckerja_order_receipt_logo_is_public`, `lead_status_is_resolved_or_expired_visibility` |

### 0029 — authenticated can execute SECURITY DEFINER function (~363)

Normal app RPCs called after login. Each one is expected to check `auth.uid()` / org membership.

### 0011 — function search_path mutable (45)

Small `LANGUAGE sql` helpers (traffic, POS, billing). Setting `search_path` stops Postgres from inlining
them into queries, which slows analytics/POS reports. They reference no unqualified tables.

### 0008 — RLS enabled, no policy (INFO, 61)

Internal tables (OAuth states, secrets, logs, queues). No policy means no API access at all;
only the service role (edge functions) can use them. This is the intended, safest state.

## Weekly check

A scheduled task runs every week and only reports what is **new** compared with this file:

1. `get_advisors` (security + performance) → `python3 scripts/security/advisor_keys.py diff docs/security-advisor-baseline.json SEC.json PERF.json`.
   `docs/security-advisor-baseline.json` is the machine-readable list of every accepted finding.
   Performance INFO lints `unindexed_foreign_keys` / `unused_index` are compared by count only.
2. `supabase/tests/tenant_isolation_check.sql` via `execute_sql` (read-only, rolls back).
   Findings are grouped by `table + operation`; only groups not listed below are reported.

After an intentional change, regenerate the baseline with
`advisor_keys.py snapshot SEC.json PERF.json > docs/security-advisor-baseline.json` and commit it.

### Known tenant-isolation findings (2026-11-20, open)

Any signed-in user (even with no organization) can read these rows of other organizations:

| Table + op | Why | Plan |
|---|---|---|
| `recruitment_links SELECT` | policy allows every active, unexpired link (`status='active'`) | restrict to members; serve the public job page through a SECURITY DEFINER RPC by token |
| `job_openings SELECT` | policy allows any job that has an active recruitment link | follows automatically once `recruitment_links` is member-only |
| `question_review SELECT` | `question_review_select_auth` is `COALESCE(is_active, true)` with no org filter | add org filter (keep global/default rows readable) |

No cross-org UPDATE or DELETE was possible on any of the 488 tables checked.

## History

- 2026-11-20 `20261120080000` — tenant-scoped writes for WA templates / web_id / API settings (cross-org leak fixed).
- 2026-11-20 `20261120090000` — email verification OTP rate limit; legacy token RPCs closed.
- 2026-11-20 `20261120100000` — EXECUTE revoked from API roles on trigger functions, and from `anon` on login-only / server-only functions.
- 2026-11-20 — weekly check added: machine-readable baseline + tenant isolation test.
