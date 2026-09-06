/** Format shift open/close timestamps for dialogs and reports. */
export function formatPosShiftDateTime(
  iso: string,
  language: string,
  opts?: { includeWeekday?: boolean },
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const locale = language.startsWith("en") ? "en-US" : "id-ID";
  const includeWeekday = opts?.includeWeekday !== false;
  const weekday = includeWeekday
    ? `${d.toLocaleDateString(locale, { weekday: "long" })}, `
    : "";
  const date = d.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (locale.startsWith("en")) {
    return `${weekday}${date} at ${time}`;
  }
  return `${weekday}${date} pada ${time}`;
}

/** Standard Shift UI: "Sunday, 6 Sept 2026" + separate time line. */
export function formatPosShiftDateParts(
  iso: string,
  language: string,
): { dateLine: string; timeLine: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { dateLine: iso, timeLine: "—" };
  const locale = language.startsWith("en") ? "en-GB" : "id-ID";
  const weekday = d.toLocaleDateString(locale, { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return {
    dateLine: `${weekday}, ${day} ${month} ${year}`,
    timeLine: time,
  };
}
