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
      smallIcon: "splash_white_logo",
    },
    PushNotifications: {
      smallIcon: "splash_white_logo",
    },
    SplashScreen: {
      launchAutoHide: true,
    },
  },
};

export default config;
