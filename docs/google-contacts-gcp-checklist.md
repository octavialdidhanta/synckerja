# Google Contacts – manual GCP checklist

Status operasional (di luar kode):

| Item | Status |
|------|--------|
| People API enabled | Done |
| Scopes `contacts` + `contacts.other.readonly` on consent screen | Done |
| Redirect URI on client **Synckerja**: `https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/google-contacts-oauth-callback` | Done (verify `https://` + full project ref) |
| Paste scope justification (see `docs/google-contacts-oauth-verification.md`) | **TODO** |
| Deploy updated `/policy/privacy` with Contacts disclosure | **TODO** after deploy |
| Add OAuth test users while app is in Testing | **TODO** |
| Record demo video + Submit verification | **TODO** after feature QA |

Do **not** remove existing Synckerja client redirect URIs for Drive SPA or Supabase Auth SSO.
