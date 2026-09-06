import type { CapacitorConfig } from "@capacitor/cli";

/** Native Synckerja Office shell → `android/` / Play package `id.synckerja.app`. */
const config: CapacitorConfig = {
  appId: "id.synckerja.app",
  appName: "Synckerja Office",
  webDir: "dist",
  backgroundColor: "#f5f5f5",
  android: {
    path: "android",
    /** Selaras strip status bar putih; area konten mobile tetap bisa abu terang di CSS. */
    backgroundColor: "#ffffff",
  },
  plugins: {
    CapacitorHttp: {
      /** Native HTTP for Blob PUT (Drive resumable upload) — WebView fetch + Blob fails on Android. */
      enabled: true,
    },
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: "#ffffff",
      style: "LIGHT",
    },
    LocalNotifications: {
      smallIcon: "ic_notification_small",
    },
    PushNotifications: {
      smallIcon: "ic_notification_small",
    },
    SplashScreen: {
      /** Disembunyikan dari JS (`NativeBootstrapSplashGate`) setelah bootstrap data siap. */
      launchAutoHide: false,
      backgroundColor: "#f5f5f5",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_INSIDE",
      /** Referensi: fullscreen splash sering mengacaukan inset bilah sistem setelah hide/resume. */
      splashFullScreen: false,
      /** false = bilah sistem (back/home/recent) tetap terlihat; true menyembunyikannya sampai gesture. */
      splashImmersive: false,
    },
  },
};

export default config;
