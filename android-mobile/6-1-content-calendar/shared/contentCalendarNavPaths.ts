import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";

export const CONTENT_CALENDAR_PATH = "/digital-marketing/social-media/content-calendar" as const;

export type ContentCalendarTab = "calendar" | "funnel" | "balance" | "persona";

const VALID_TABS: readonly ContentCalendarTab[] = ["calendar", "funnel", "balance", "persona"];

export function parseContentCalendarTab(search: string): ContentCalendarTab {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const tab = new URLSearchParams(query).get("tab");
  if (tab && (VALID_TABS as readonly string[]).includes(tab)) {
    return tab as ContentCalendarTab;
  }
  return "calendar";
}

export function contentCalendarHref(tab: ContentCalendarTab): string {
  if (tab === "calendar") return CONTENT_CALENDAR_PATH;
  return `${CONTENT_CALENDAR_PATH}?tab=${tab}`;
}

export function pagePathForContentCalendarTab(tab: ContentCalendarTab): string {
  return tab === "persona"
    ? MOBILE_PAGE_PATH.digitalMarketingScriptGenerator
    : MOBILE_PAGE_PATH.digitalMarketingContentCalendar;
}
