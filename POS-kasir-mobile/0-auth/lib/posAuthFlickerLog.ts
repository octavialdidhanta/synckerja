/** Debug tag for ADB: `adb logcat | Select-String POS_AUTH_FLICKER` */
const TAG = "[POS_AUTH_FLICKER]";

export function posAuthFlickerLog(
  event: string,
  detail?: Record<string, string | number | boolean | null | undefined>,
): void {
  const payload = detail ? ` ${JSON.stringify(detail)}` : "";
  // eslint-disable-next-line no-console -- intentional ADB/Capacitor console bridge
  console.log(`${TAG} ${event}${payload}`);
}
