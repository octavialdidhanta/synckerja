# Google Sign-In (Android native)

SHA-1 fingerprints are **not** stored in app source code. Google validates the **signed APK** against OAuth clients registered in **Google Cloud** / **Firebase**. The app only uses the **Web application** client ID in `.env` (`VITE_GOOGLE_SSO_WEB_CLIENT_ID`) as `serverClientId` for native sign-in + Supabase `signInWithIdToken`.

## OAuth clients in GCP (project `909034086376`)

| GCP name | Type | SHA-1 / ID | When |
|----------|------|------------|------|
| **Synckerja** | Web | `909034086376-54m2vv12...` | `.env`, Supabase Auth → Google |
| **Synckerja Android Debug** | Android | `C1:82:4D:9E:1F:12:DF:5C:CB:3B:0E:92:E7:89:D7:7E:76:64:A6:F9` | APK from **Android Studio** / debug keystore |
| **Synckerja Android SHA-1** | Android | `4A:A9:64:E6:3E:C2:6F:8A:0B:A0:E4:03:1C:37:0C:2E:F1:9B:05:4B` | APK from **Play Store** (App signing key in Play Console) |

Keep **both** Android clients. Do **not** put Android client IDs (`4elv...`, `p25v...`) in `VITE_GOOGLE_SSO_WEB_CLIENT_ID`.

### Debug SHA-1 (local)

```powershell
cd android
.\gradlew.bat :app:signingReport
```

### Play Store SHA-1

Play Console → **Setup** → **App integrity** → **App signing key certificate** → copy SHA-1 (e.g. `4A:A9:64:...`) → register on **Synckerja Android SHA-1** (or Firebase fingerprints).

## Firebase (recommended)

Project **profitloop** → Android app `id.synckerja.app` → add **both** SHA-1 fingerprints → download `google-services.json` → `android/app/google-services.json`.

## Error [28444]

Usually missing/wrong Android OAuth client for the APK you installed, or Web client ID mismatch with Supabase. Match the SHA-1 to how you installed the app (debug vs Play).

## Rebuild after GCP/Firebase changes

```powershell
npm run build
npm run android:sync
```

Uninstall old app → reinstall. Wait 5–15 minutes after GCP changes.
