# Auth module — Google OAuth flows

Synckerja uses **three separate Google OAuth integrations**. Do not mix redirect URIs or client IDs.

| Flow | App route | OAuth client | Scopes |
|------|-----------|--------------|--------|
| **Login / Register** (Supabase Auth) | Web: `/auth/sso/callback` · Native: in-app SDK | Supabase Dashboard → Auth → Google + platform clients | `openid`, `email`, `profile` |
| **Drive preview** | `/auth/google/callback` | `GOOGLE_CLIENT_ID` (edge + env) | `drive.file` (+ Google Picker) |
| **Google Ads** | Edge `google-ads-oauth-callback` | `GOOGLE_ADS_CLIENT_ID` | `adwords` |

## Google Drive (`drive.file`) — GCP checklist

Manual steps in **Google Cloud Console** (project used for Drive OAuth, e.g. Profitloop):

1. **OAuth consent screen** — remove `drive.readonly`; add `https://www.googleapis.com/auth/drive.file`.
2. **APIs** — enable **Google Picker API**.
3. **Credentials** — browser **API key** for Picker (HTTP referrer: production domain + `http://localhost:*`).
4. **OAuth Web client** (`GOOGLE_CLIENT_ID`) — Authorized JavaScript origins include your app origin(s).
5. **Frontend `.env`** — `VITE_GOOGLE_PICKER_API_KEY`, `VITE_GOOGLE_PICKER_APP_ID` (numeric Cloud project number).
6. After deploy — users with old tokens: **Disconnect → Connect Google** once.

Reply to Google OAuth verification with **Confirming narrower scopes** (see `docs/google-drive-scope-verification-email.md`).

## Login with Google (Supabase)

### Web (browser)

1. **Authentication → Providers → Google** in Supabase: Client ID + Secret.
2. **Redirect URLs**: `https://office.synckerja.com/auth/sso/callback`, `http://localhost:8080/**`, etc.
3. Flow: `signInWithOAuth` → redirect to Google → `/auth/sso/callback` → PKCE session.

### Native (Capacitor Android / iOS) — no external browser

Native uses **Google Sign-In SDK** (`@capgo/capacitor-social-login`) and Supabase **`signInWithIdToken`**. The account picker stays inside the app.

**Client ID resolution (first match wins):**

1. `VITE_GOOGLE_SSO_WEB_CLIENT_ID` in `.env` at `npm run build` (recommended for local/Android Studio builds) — **same** as Supabase Auth → Google → Client ID
2. Edge Function `google-sso-public-config` — set secret `GOOGLE_SSO_WEB_CLIENT_ID` (and optional `GOOGLE_SSO_IOS_CLIENT_ID`) on Supabase, then deploy the function (works without rebuilding the app)
3. `VITE_GOOGLE_CLIENT_ID` is **Google Drive only** — do not use as SSO fallback when it differs from the Auth provider client

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_GOOGLE_SSO_WEB_CLIENT_ID` | Yes (unless Edge secret + deploy) | Web client ID — **same** as Supabase Auth → Google → Client ID; `serverClientId` on Android |
| `VITE_GOOGLE_SSO_IOS_CLIENT_ID` | Yes on iOS | iOS OAuth client from Google Cloud |

**Google Cloud Console (same project as Supabase Google provider):**

1. **Web client** — already used by Supabase Auth.
2. **Android client** — package `id.synckerja.app` + SHA-1 (debug + release) from your keystore.
3. **MainActivity** — `android/app/.../MainActivity.java` implements `ModifiedMainActivityForSocialLoginPlugin` (required by Capgo; do not pass custom `scopes` from JS unless this is in place).
4. **Android SHA-1** — use **two** Android OAuth clients for `id.synckerja.app`: (a) **debug** SHA-1 from `.\gradlew.bat :app:signingReport` for Android Studio installs; (b) **Play App signing** SHA-1 from Play Console → App integrity for store installs. Do not delete the Play SHA-1 client when debug works locally. See [`android/README-GOOGLE-SIGNIN.md`](../android/README-GOOGLE-SIGNIN.md).
5. **Web client ID only in app** — `initialize` / `VITE_GOOGLE_SSO_WEB_CLIENT_ID` must be the **Web** client (same as Supabase Auth → Google), never the Android client ID string.
6. **iOS client** — bundle ID `id.synckerja.app` (when building iOS).

Supabase **Google provider**: enable; use Web client ID (+ secret for web OAuth only). Native id-token flow does not need the custom scheme redirect for login (deep link callback is fallback only).

**Deploy Edge fallback (optional):**

```bash
npx supabase secrets set GOOGLE_SSO_WEB_CLIENT_ID="YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"
npx supabase functions deploy google-sso-public-config
```

**After env / GCP changes:** `npm run build` → `npx cap sync android` (and `ios`).

### Code entry points

- Start: [`lib/googleSignIn.ts`](lib/googleSignIn.ts) — web OAuth vs [`lib/nativeGoogleSso.ts`](lib/nativeGoogleSso.ts) on native
- Web callback: [`screens/SupabaseSsoCallbackScreen.tsx`](screens/SupabaseSsoCallbackScreen.tsx)
- Post-session: [`lib/completeGoogleSsoLogin.ts`](lib/completeGoogleSsoLogin.ts)
- Native init: [`native/NativeGoogleAuthInit.tsx`](native/NativeGoogleAuthInit.tsx)
- Legacy deep link (if OAuth URL opened): [`native/NativeSupabaseOAuthBridge.tsx`](native/NativeSupabaseOAuthBridge.tsx)

### Database

Migration `20260522120000_0-auth_google_oauth_email_verified.sql`:

- `registration_has_verified_email` — true for OTP **or** Google identity
- `mark_oauth_registration_verified` — marks verification row after Google SSO (authenticated caller only)
