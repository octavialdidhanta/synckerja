import { registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

export type ShareIntentFileItem = {
  path: string;
  name: string;
  mimeType: string;
};

export type ShareIntentPluginType = {
  getPendingPayload(): Promise<{ files: ShareIntentFileItem[] }>;
  clearPending(): Promise<void>;
  addListener(
    eventName: "shareIntentReceived",
    listenerFunc: (payload: { files: ShareIntentFileItem[] }) => void,
  ): Promise<PluginListenerHandle>;
};

/** Bridges Android `ShareIntentPlugin` (share into app → pending files in cache). */
export const ShareIntent = registerPlugin<ShareIntentPluginType>("ShareIntent");
