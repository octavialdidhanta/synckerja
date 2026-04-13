/**
 * Haptic / ringan untuk notifikasi in-app (live chat inbound, dll.).
 * Tanpa file audio — menghindari autoplay policy; vibrate saat didukung.
 */
export type PlayNotificationSoundOptions = {
  vibrate?: boolean;
};

export function playNotificationSound(options?: PlayNotificationSoundOptions): void {
  if (typeof window === "undefined") return;
  if (options?.vibrate !== true) return;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(120);
    }
  } catch {
    // ignore
  }
}
