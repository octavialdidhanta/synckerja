# Android + Capacitor sync

**Jalankan semua perintah npm/Capacitor dari root workspace** (`Synckerja Office`, tempat `package.json` dan `capacitor.config.ts`), bukan dari subfolder lain — agar `webDir` (`dist/`) dan `node_modules` ter-resolve benar.

## Menyalin UI web terbaru ke APK/AAB

1. `npm run android:prepare` — setara `npm run build` lalu `npx cap sync android` (menyalin `dist/` ke `android/app/src/main/assets/public` dan memperbarui `capacitor.config.json` di assets).
2. Atau terpisah: `npm run android:build-web` lalu `npm run android:sync`.
3. Buka `android` di Android Studio (`npm run android:open`) lalu **Build → Rebuild Project** (atau Gradle `bundleRelease` / `assembleRelease`).

## Plugin native kustom

Plugin Java lokal (`ZoomDisablePlugin`, `SafeAreaInsetsPlugin`, `NoOverscrollPlugin`, `ShareIntentPlugin`, `PhotoPickerPlugin`, `NotificationLaunchPlugin`) didaftarkan di `MainActivity` **sebelum** `super.onCreate()` dengan `registerPlugin(...)`. Tidak ada skrip patch pasca-sync; file `app/src/main/assets/capacitor.plugins.json` dihasilkan `cap sync` untuk paket npm resmi Capacitor.

## Referensi

- Konfigurasi sumber: `capacitor.config.ts` di root repo.
- Teks siap tempel Play Console: `PLAY_CONSOLE_DECLARATIONS.txt`.
