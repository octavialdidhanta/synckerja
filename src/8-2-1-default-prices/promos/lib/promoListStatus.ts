import type { CatalogPromo, PromoListStatus, PromoListStatusFilter } from "../types";

type PeriodFields = Pick<
  CatalogPromo,
  "time_period_enabled" | "starts_on" | "ends_on" | "starts_at_time" | "ends_at_time" | "name"
>;

function parseTimeParts(time: string | null | undefined): { hours: number; minutes: number } | null {
  if (!time) return null;
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return { hours, minutes };
}

function parseLocalBoundary(
  date: string | null | undefined,
  time: string | null | undefined,
  endOfDay: boolean,
): Date | null {
  if (!date) return null;
  const [yearRaw, monthRaw, dayRaw] = date.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const parsedTime = parseTimeParts(time);
  if (parsedTime) {
    return new Date(year, month - 1, day, parsedTime.hours, parsedTime.minutes, endOfDay ? 59 : 0);
  }
  return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
}

export function promoListStatus(promo: PeriodFields, now: Date = new Date()): PromoListStatus {
  if (!promo.time_period_enabled) return "ongoing";
  if (!promo.starts_on || !promo.ends_on) return "ongoing";
  const start = parseLocalBoundary(promo.starts_on, promo.starts_at_time, false);
  const end = parseLocalBoundary(promo.ends_on, promo.ends_at_time, true);
  if (!start || !end) return "ongoing";
  if (now.getTime() < start.getTime()) return "scheduled";
  if (now.getTime() > end.getTime()) return "inactive";
  return "ongoing";
}

export function matchesPromoListFilters(
  promo: PeriodFields,
  filters: { status: PromoListStatusFilter; query: string },
  now: Date = new Date(),
): boolean {
  if (filters.status !== "all" && promoListStatus(promo, now) !== filters.status) return false;
  const query = filters.query.trim().toLowerCase();
  if (query && !(promo.name ?? "").toLowerCase().includes(query)) return false;
  return true;
}
