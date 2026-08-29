import type { PosNotificationSoundId } from "./posSettingsCopy";
import { POS_NOTIFICATION_SOUND_OPTIONS } from "./posSettingsCopy";

const STORAGE_PREFIX = "synckerja_pos_settings_";

export type PosDeviceSettings = {
  onlineOrdersEnabled: boolean;
  notificationSoundEnabled: boolean;
  notificationSoundId: PosNotificationSoundId;
  /** Device-only: staff monitor preference (no backend yet). Default ON. */
  employeeMonitorEnabled: boolean;
};

export const DEFAULT_POS_DEVICE_SETTINGS: PosDeviceSettings = {
  onlineOrdersEnabled: true,
  notificationSoundEnabled: true,
  notificationSoundId: "telepathy",
  employeeMonitorEnabled: true,
};

function storageKey(outletId: string): string {
  return `${STORAGE_PREFIX}${outletId}`;
}

function isSoundId(value: unknown): value is PosNotificationSoundId {
  return POS_NOTIFICATION_SOUND_OPTIONS.some((o) => o.id === value);
}

export function readPosDeviceSettings(outletId: string): PosDeviceSettings {
  try {
    const raw = localStorage.getItem(storageKey(outletId));
    if (!raw) return { ...DEFAULT_POS_DEVICE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<PosDeviceSettings>;
    return {
      onlineOrdersEnabled:
        typeof parsed.onlineOrdersEnabled === "boolean"
          ? parsed.onlineOrdersEnabled
          : DEFAULT_POS_DEVICE_SETTINGS.onlineOrdersEnabled,
      notificationSoundEnabled:
        typeof parsed.notificationSoundEnabled === "boolean"
          ? parsed.notificationSoundEnabled
          : DEFAULT_POS_DEVICE_SETTINGS.notificationSoundEnabled,
      notificationSoundId: isSoundId(parsed.notificationSoundId)
        ? parsed.notificationSoundId
        : DEFAULT_POS_DEVICE_SETTINGS.notificationSoundId,
      employeeMonitorEnabled:
        typeof parsed.employeeMonitorEnabled === "boolean"
          ? parsed.employeeMonitorEnabled
          : DEFAULT_POS_DEVICE_SETTINGS.employeeMonitorEnabled,
    };
  } catch {
    return { ...DEFAULT_POS_DEVICE_SETTINGS };
  }
}

export function writePosDeviceSettings(outletId: string, settings: PosDeviceSettings): void {
  try {
    localStorage.setItem(storageKey(outletId), JSON.stringify(settings));
  } catch {
    /* ignore quota / private mode */
  }
}
