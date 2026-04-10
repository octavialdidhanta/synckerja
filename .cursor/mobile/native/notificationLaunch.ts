import { registerPlugin } from "@capacitor/core";

export type NotificationLaunchPluginType = {
  consumePendingPushTap: () => Promise<Record<string, string>>;
};

/** Bridges FCM taps from {@link id.synckerja.app.NotificationLaunchPlugin} (custom local notifications). */
export const NotificationLaunch = registerPlugin<NotificationLaunchPluginType>("NotificationLaunch");
