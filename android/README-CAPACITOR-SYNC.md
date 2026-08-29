# Android + Capacitor sync (Synckerja Office)

**Jalankan semua perintah npm/Capacitor dari root workspace** (tempat `package.json` dan `capacitor.config.ts`), bukan dari subfolder lain — agar `webDir` (`dist/`) dan `node_modules` ter-resolve benar.

## Synckerja Office (`android/` / `id.synckerja.app`)

1. `npm run android:prepare` — `npm run build` lalu `npx cap sync android` (menyalin `dist/` ke `android/app/src/main/assets/public`).
2. Atau: `npm run android:build-web` lalu `npm run android:sync`.
3. `npm run android:open` → Android Studio → Rebuild / `bundleRelease`.

Config: [`capacitor.config.ts`](../capacitor.config.ts) (`android.path: android`).

## Synckerja POS (`android-pos/` / `id.synckerja.pos`)

Shell POS terpisah — lihat [`../android-pos/README.md`](../android-pos/README.md).

```bash
npm run android-pos:prepare
npm run android-pos:open
```

Config: [`capacitor.config.pos.ts`](../capacitor.config.pos.ts).

Bluetooth thermal printer (`PosBluetoothPrinter`) **hanya** di `android-pos`, bukan di Office.

## Plugin native kustom (Office)

Plugin Java lokal (`ZoomDisablePlugin`, `SafeAreaInsetsPlugin`, `NoOverscrollPlugin`, `WebViewMediaPlugin`, `ShareIntentPlugin`, `PhotoPickerPlugin`, `NotificationLaunchPlugin`) didaftarkan di Office `MainActivity` **sebelum** `super.onCreate()`.

## Referensi

- Teks siap tempel Play Console (Office): `PLAY_CONSOLE_DECLARATIONS.txt`.
- Google Sign-In (Office): `README-GOOGLE-SIGNIN.md`.
