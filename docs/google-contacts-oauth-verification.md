# Synckerja – Google Contacts (People API) OAuth Verification

**Status: Approved** (2026-07-26). Sensitive scopes `contacts` and `contacts.other.readonly` are verified for project **profitloop** (`909034086376`). All Synckerja customers can connect Google Contacts without the unverified-app / 100-test-user Testing cap (once OAuth consent publishing status is **In production**).

| | |
|---|---|
| **Product** | Synckerja |
| **App URL** | https://office.synckerja.com |
| **Privacy Policy** | https://office.synckerja.com/policy/privacy |
| **Terms of Service** | https://office.synckerja.com/policy/terms |
| **Support email** | business@vialdi.id |
| **OAuth client name** | Synckerja (Web application) |
| **Redirect URI** | `https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/google-contacts-oauth-callback` |
| **Scopes** | `https://www.googleapis.com/auth/contacts`, `https://www.googleapis.com/auth/contacts.other.readonly` |
| **API** | Google People API (`people.googleapis.com`) |
| **GCP project** | `profitloop` (`909034086376`) |
| **Demo video** | https://youtu.be/7rCTRDpgGvw |

> Credentials: **reuse** client Web **Synckerja** (sama dengan Google Drive). Jangan pakai client Ads atau YouTube.

---

## 1. Checklist (completed)

- [x] People API enabled
- [x] Scopes ditambahkan di OAuth consent screen
- [x] Redirect URI Edge Contacts ditambahkan ke client Synckerja
- [x] Privacy Policy menyebut Google Contacts / People API (deploy halaman `/policy/privacy`)
- [x] Isi justifikasi “How will the scopes be used?” di Cloud Console
- [x] Connect Google Contacts berhasil di Testing mode (test users)
- [x] Demo video 2–3 menit — https://youtu.be/7rCTRDpgGvw
- [x] Submit verification / Prepare for verification
- [x] **Verification approved** (2026-07-26) — `contacts` + `contacts.other.readonly`

---

## 2. Scope justification (paste ke Cloud Console)

### `https://www.googleapis.com/auth/contacts`

Synckerja is a multi-tenant CRM / omnichannel workspace. When an organization administrator connects their Google account in Omnichannel → Settings → Google Contacts, Synckerja creates and updates Google Contacts for CRM leads that include at least a phone number (name, phone, optional email, and a short Synckerja source note). This lets customer names and numbers appear in the administrator’s Google Contacts and phone/WhatsApp address book without manual retyping. Contacts are written only to the Google account the administrator authorized for that organization. We do not delete Google Contacts when a lead is removed in Synckerja.

### `https://www.googleapis.com/auth/contacts.other.readonly`

Used only to search “Other contacts” by phone or email before creating a new contact, so Synckerja does not create duplicates for numbers already stored automatically by Google. We do not use this scope to export, sell, or transfer Other contacts outside the sync feature.

---

## 3. Demo script (untuk video verification)

1. Buka `https://office.synckerja.com/omnichannel/settings/google-contacts` sebagai org admin.
2. Klik **Hubungkan Google Contacts** → consent screen menampilkan scope Contacts.
3. Setelah connected, tampilkan email akun Google yang terhubung.
4. Buat lead baru di `/omnichannel/leads` dengan nama + nomor telepon.
5. Tunjukkan kolom **Sync Contacts** berubah ke tersinkron (atau Contacts di akun Google berisi lead tersebut).
6. Edit lead: tambahkan email → tunjukkan kontak Google ter-update.
7. Klik **Putuskan** di settings → jelaskan sync berhenti.

Published demo: https://youtu.be/7rCTRDpgGvw

---

## 4. Edge secrets / deploy

Reuse:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (client Web Synckerja)
- Encryption: `GOOGLE_CONTACTS_CONFIG_ENCRYPTION_KEY` **atau** fallback `GOOGLE_ADS_CONFIG_ENCRYPTION_KEY`
- Optional: `GOOGLE_CONTACTS_OAUTH_REDIRECT_URI`
- Cron invoke: Vault `google_contacts_scheduler_*` atau fallback `google_ads_scheduler_*`

Deploy functions:

- `google-contacts-oauth-start`
- `google-contacts-oauth-callback`
- `google-contacts-config`
- `google-contacts-sync`

Apply migration: `20260930130000_organization_google_contacts_per_tenant.sql`

---

## 5. Production (post-approval)

- OAuth consent screen **Publishing status** should be **In production** so refresh tokens are not limited to the Testing-mode 7-day expiry.
- **Test users** are no longer required for external customers to connect Google Contacts.
- If you add new sensitive/restricted scopes or materially change the consent screen, submit a **new** verification — approval for Contacts does not cover other scopes.

---

## 6. AI/ML Limited Use (verification follow-up)

During review, Google asked for clarification that Workspace / People API data is not used to train foundational AI models.

**Response (confirmed in code + privacy):**

- Google Contacts / People API data is used only for one-way CRM lead sync into the admin’s Google Contacts. It is **not** sent to third-party AI providers.
- Separate Synckerja AI features (script/receipt tooling) may use **Google Gemini API** (pay-as-you-go), **Groq** (free tier), and **Fireworks AI** (free tier) on user-provided content only — not on People API / Contacts data.
- Public disclosure: https://office.synckerja.com/policy/privacy (Google API Limited Use + Google Contacts / People API sections).
