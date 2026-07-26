# Google Contacts – manual GCP checklist

Status operasional (di luar kode):

| Item | Status |
|------|--------|
| People API enabled | Done |
| Scopes `contacts` + `contacts.other.readonly` on consent screen | Done |
| Redirect URI on client **Synckerja**: `https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/google-contacts-oauth-callback` | Done (verify `https://` + full project ref) |
| Paste scope justification (see `docs/google-contacts-oauth-verification.md`) | Done |
| Deploy updated `/policy/privacy` with Contacts disclosure | Done |
| Add OAuth test users while app is in Testing | Done (no longer required after approval) |
| Record demo video + Submit verification | Done (`https://youtu.be/7rCTRDpgGvw`) |
| **Verification APPROVED** — scopes `contacts` + `contacts.other.readonly` | **Done** — project `profitloop` (`909034086376`), 2026-07-26 |
| OAuth consent screen **Publishing status = In production** | Confirm in Cloud Console (removes Testing-mode 7-day refresh-token limit) |

Do **not** remove existing Synckerja client redirect URIs for Drive SPA or Supabase Auth SSO.

## Reminders (from Google approval email)

- Keep Project Owner / Project Editor accounts up to date in Cloud Console.
- Submit a **new** verification request if you add sensitive/restricted scopes or change the OAuth consent screen in ways that require re-review.
- Approval for these Contacts scopes does **not** inherit to other unapproved sensitive/restricted scopes on the same or other projects.
