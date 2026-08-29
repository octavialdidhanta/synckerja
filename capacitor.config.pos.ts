import type { CapacitorConfig } from "@capacitor/cli";

/** Native Synckerja POS shell → `android-pos/` / Play package `id.synckerja.pos`. */
const config: CapacitorConfig = {
  appId: "id.synckerja.pos",
  appName: "Synckerja POS",
  webDir: "dist",
  backgroundColor: "#f5f5f5",
  android: {
    path: "android-pos",
    backgroundColor: "#ffffff",
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: "#ffffff",
      style: "LIGHT",
    },
    LocalNotifications: {
      smallIcon: "app_brand_logo",
    },
    PushNotifications: {
      smallIcon: "app_brand_logo",
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#f5f5f5",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_INSIDE",
      splashFullScreen: false,
      splashImmersive: false,
    },
  },
};

export default config;
