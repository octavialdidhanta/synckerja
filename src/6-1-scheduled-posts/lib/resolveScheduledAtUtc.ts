import { wibLocalStringToUtcIso } from '@/5-3-whatsapp-template/utils/wibLocalSchedule';

/** Combine plan post_date (date) with HH:mm WIB → UTC ISO string. */
export function resolveScheduledAtUtc(postDateIso: string, timeHhMm: string): string | null {
  const datePart = postDateIso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const timePart = timeHhMm.trim().slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(timePart)) return null;
  return wibLocalStringToUtcIso(`${datePart}T${timePart}`);
}

export function formatTimeWibFromUtc(isoUtc: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  });
}

export function formatDefaultTimeFromDb(timeValue: string | null | undefined): string {
  if (!timeValue) return '18:00';
  const m = /^(\d{2}):(\d{2})/.exec(timeValue.trim());
  if (!m) return '18:00';
  return `${m[1]}:${m[2]}`;
}
