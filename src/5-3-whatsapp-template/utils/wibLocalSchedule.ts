/**
 * Interpret `datetime-local` value as **Asia/Jakarta (UTC+7)** and return an ISO-8601 UTC string for `timestamptz`.
 *
 * Accepts `YYYY-MM-DDTHH:mm` and optional seconds / fractional seconds from browsers (e.g. `…T14:30:00`).
 */
export function wibLocalStringToUtcIso(datetimeLocal: string): string | null {
  const s = datetimeLocal.trim();
  if (!s) return null;
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(s);
  if (!m) return null;
  const secRaw = m[6] != null && String(m[6]).length > 0 ? String(m[6]).padStart(2, "0").slice(0, 2) : "00";
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${secRaw}+07:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
