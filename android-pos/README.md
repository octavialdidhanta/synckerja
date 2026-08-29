# android-pos — Synckerja POS (native)

Capacitor Android shell for **Synckerja POS**.

| | |
|--|--|
| Package / `applicationId` | `id.synckerja.pos` |
| App name | Synckerja POS |
| Config | [`capacitor.config.pos.ts`](../capacitor.config.pos.ts) (`android.path: android-pos`) |
| Web UI | Shared Vite `dist/` — cold start redirects `/` → `/pos` |
| Bluetooth printers | `PosBluetoothPrinterPlugin` (classic SPP) |

Office native app remains in [`../android/`](../android/) (`id.synckerja.app`) and does **not** include the printer plugin.

## Scripts (repo root)

```bash
npm run android-pos:prepare   # vite build + cap sync → android-pos
npm run android-pos:sync      # sync only (needs dist/)
npm run android-pos:open      # Android Studio
```

`android-pos:*` memakai [`scripts/cap-android-pos.mjs`](../scripts/cap-android-pos.mjs) untuk sementara memakai `capacitor.config.pos.ts` (Capacitor CLI tidak punya flag `--config`), lalu mengembalikan config Office.

Office:

```bash
npm run android:prepare
npm run android:open
```

## Custom plugins (slim)

Registered in `MainActivity`:

- ZoomDisable, SafeAreaInsets, NoOverscroll, WebViewMedia
- **PosBluetoothPrinter** (thermal ESC/POS over Bluetooth SPP)

Not included (Office-only): ShareIntent, PhotoPicker, NotificationLaunch share routing.

## Manual checklist (Play / Firebase / Auth)

1. **Firebase** — Add Android app `id.synckerja.pos`, download `google-services.json` into `android-pos/app/` (do not reuse Office JSON).
2. **Google Cloud OAuth** — Create Android OAuth client for `id.synckerja.pos` + debug/release SHA-1.
3. **Supabase Auth** — Allow redirect URL `id.synckerja.pos://auth/sso/callback`.
4. **Play Console** — New listing “Synckerja POS”; upload AAB from this module.

Until `google-services.json` exists, the google-services Gradle plugin is skipped (same pattern as Office).

## Orientation

`fullSensor` — suitable for tablet cashier landscape/portrait.

## Verify

1. `npm run android-pos:prepare`
2. Open in Android Studio → Run on tablet/emulator
3. App opens at `/pos` (welcome/login)
4. Settings → Hardware → Printer → Refresh (Bluetooth scan on device)
