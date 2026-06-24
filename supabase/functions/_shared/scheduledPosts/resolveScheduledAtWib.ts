export function formatDefaultTimeFromDb(timeValue: string | null | undefined): string {
  if (!timeValue) return "18:00";
  const m = /^(\d{2}):(\d{2})/.exec(timeValue.trim());
  if (!m) return "18:00";
  return `${m[1]}:${m[2]}`;
}

/** Combine plan post_date (date) with HH:mm WIB → UTC ISO string. */
export function resolveScheduledAtUtc(postDateIso: string, timeHhMm: string): string | null {
  const datePart = postDateIso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const timePart = timeHhMm.trim().slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(timePart)) return null;
  const iso = `${datePart}T${timePart}:00+07:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function buildScheduleCaption(
  title: string | null | undefined,
  briefCaption: string | null | undefined,
): string {
  const parts: string[] = [];
  const t = title?.trim();
  const b = briefCaption?.trim();
  if (t) parts.push(t);
  if (b && b !== t) parts.push(b);
  return parts.join("\n\n").slice(0, 2200);
}
