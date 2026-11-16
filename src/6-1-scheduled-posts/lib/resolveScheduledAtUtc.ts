import { wibLocalStringToUtcIso } from '@/5-3-whatsapp-template/utils/wibLocalSchedule';
import { calendarDayYmd } from './onTimeStatus';

/** Combine plan post_date (date) with HH:mm WIB → UTC ISO string. */
export function resolveScheduledAtUtc(postDateIso: string, timeHhMm: string): string | null {
  // Timestamps like 2026-11-14T17:00:00Z are midnight 15 Nov WIB — use Jakarta day, not UTC slice.
  const datePart = calendarDayYmd(postDateIso);
  if (!datePart) return null;
  const timePart = timeHhMm.trim().slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(timePart)) return null;
  return wibLocalStringToUtcIso(`${datePart}T${timePart}`);
}

export function formatTimeWibFromUtc(isoUtc: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '';
  if (!/^\d{2}$/.test(hour) || !/^\d{2}$/.test(minute)) return '';
  return `${hour}:${minute}`;
}

/** Saved schedule time for the publish-setup input. Falls back to the org default (often 18:00). */
export function scheduleTimeWibOrDefault(
  scheduledAtIso: string | null | undefined,
  defaultTimeWib: string,
): string {
  const fromSchedule = scheduledAtIso ? formatTimeWibFromUtc(scheduledAtIso) : '';
  if (/^\d{2}:\d{2}$/.test(fromSchedule)) return fromSchedule;
  const fallback = defaultTimeWib.trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(fallback) ? fallback : '18:00';
}

export function formatDefaultTimeFromDb(timeValue: string | null | undefined): string {
  if (!timeValue) return '18:00';
  const m = /^(\d{2}):(\d{2})/.exec(timeValue.trim());
  if (!m) return '18:00';
  return `${m[1]}:${m[2]}`;
}
