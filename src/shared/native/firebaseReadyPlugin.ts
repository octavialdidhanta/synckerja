import { registerPlugin } from "@capacitor/core";

export type FirebaseReadyPlugin = {
  isReady: () => Promise<{ ready: boolean }>;
};

export const FirebaseReady = registerPlugin<FirebaseReadyPlugin>("FirebaseReady");
