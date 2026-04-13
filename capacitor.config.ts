import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "id.synckerja.app",
  appName: "Synckerja Office",
  webDir: "dist",
  backgroundColor: "#f5f5f5",
  android: {
    backgroundColor: "#f5f5f5",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "app_brand_logo",
    },
    PushNotifications: {
      smallIcon: "app_brand_logo",
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
