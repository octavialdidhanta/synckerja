# Synckerja – Google Contacts (People API) OAuth Verification

Panduan agar scope sensitif Contacts bisa dipakai **semua customer Synckerja** (bukan hanya 100 test user).

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

> Credentials: **reuse** client Web **Synckerja** (sama dengan Google Drive). Jangan pakai client Ads atau YouTube.

---

## 1. Checklist sebelum submit

- [x] People API enabled
- [x] Scopes ditambahkan di OAuth consent screen
- [x] Redirect URI Edge Contacts ditambahkan ke client Synckerja
- [ ] Privacy Policy menyebut Google Contacts / People API (deploy halaman `/policy/privacy`)
- [ ] Isi justifikasi “How will the scopes be used?” di Cloud Console
- [ ] Connect Google Contacts berhasil di Testing mode (test users)
- [ ] Demo video 2–3 menit
- [ ] Submit verification / Prepare for verification

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

## 5. Testing mode

Tambahkan email admin org ke **Test users** di OAuth consent screen sampai verification disetujui.
