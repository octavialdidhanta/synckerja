import { formatDistanceToNow } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";

export function formatCommentRelativeTime(
  createTimeSec: number | null | undefined,
  locale: string,
): string {
  if (createTimeSec == null || !Number.isFinite(createTimeSec)) return "";
  const date = new Date(createTimeSec * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const loc = locale.startsWith("id") ? idLocale : enUS;
  return formatDistanceToNow(date, { addSuffix: true, locale: loc });
}

export function formatCommentRelativeTimeFromIso(
  iso: string | null | undefined,
  locale: string,
): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const loc = locale.startsWith("id") ? idLocale : enUS;
  return formatDistanceToNow(new Date(ms), { addSuffix: true, locale: loc });
}
