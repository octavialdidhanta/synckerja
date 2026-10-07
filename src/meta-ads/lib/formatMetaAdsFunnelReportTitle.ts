import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";

function presetTitle(selection: GoogleAdsDateRangeSelection): string {
  const labels: Partial<Record<GoogleAdsDateRangeSelection["preset"], string>> = {
    today: "Today",
    yesterday: "Yesterday",
    this_week_mon_today: "This week (Mon – Today)",
    last_7_days: "Last 7 days",
    last_week_mon_sun: "Last week (Mon – Sun)",
    last_14_days: "Last 14 days",
    this_month: "This month",
    last_30_days: "Last 30 days",
    last_month: "Last month",
    last_n_days_today: `${selection.rollingDays} days up to today`,
    last_n_days_yesterday: `${selection.rollingDays} days up to yesterday`,
    custom: "Custom",
    all_time: "All time",
  };
  if (selection.preset === "calendar_year" && selection.calendarYear != null) {
    return String(selection.calendarYear);
  }
  if (
    selection.preset === "calendar_quarter" &&
    selection.calendarYear != null &&
    selection.calendarQuarter != null
  ) {
    return `${selection.calendarYear} Q${selection.calendarQuarter}`;
  }
  return labels[selection.preset] ?? "Custom";
}

function formatHeaderDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function sameCalendarDay(from: Date, to: Date): boolean {
  return (
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth() &&
    from.getDate() === to.getDate()
  );
}

function accountTitle(accountName: string): string {
  const name = accountName.trim() || "Account";
  const withoutBrand = name.replace(/^meta cpas\s*-\s*/i, "").trim();
  return withoutBrand || name;
}

/** META CPAS - Account - This month 1 Oct 2026 - 7 Oct 2026 */
export function formatMetaAdsFunnelReportTitle(
  accountName: string,
  selection: GoogleAdsDateRangeSelection,
): string {
  const name = accountTitle(accountName);
  const preset = presetTitle(selection);
  const from = selection.range.from;
  const to = selection.range.to;
  const period =
    from && to
      ? sameCalendarDay(from, to)
        ? `${preset} ${formatHeaderDate(from)}`
        : `${preset} ${formatHeaderDate(from)} - ${formatHeaderDate(to)}`
      : preset;
  return `META CPAS - ${name} - ${period}`;
}
