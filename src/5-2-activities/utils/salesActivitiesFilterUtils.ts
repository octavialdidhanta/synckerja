import type { SalesActivity } from '@/shared/hooks/organized/sales';
import { activityTypeSearchText } from '../lib/salesActivityType';

export type SalesActivitiesDateFilter =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'last_3_months';

export type SalesActivitiesFiltersState = {
  search: string;
  status: string;
  type: string;
  payment: string;
  date: SalesActivitiesDateFilter;
};

export const DEFAULT_SALES_ACTIVITIES_FILTERS: SalesActivitiesFiltersState = {
  search: '',
  status: 'all',
  type: 'all',
  payment: 'all',
  date: 'all',
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Activity business date (`date` column); falls back to `created_at`. */
export function parseSalesActivityDate(activity: SalesActivity): Date | null {
  const raw =
    (activity as Record<string, unknown>).date ??
    (activity as Record<string, unknown>).created_at;
  if (raw == null || raw === '') return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  return startOfDay(d);
}

export function getSalesActivityDateRange(
  filter: SalesActivitiesDateFilter,
): { start: Date; endExclusive: Date } | null {
  if (filter === 'all') return null;

  const today = startOfDay(new Date());
  const y = today.getFullYear();
  const m = today.getMonth();
  const endToday = new Date(y, m, today.getDate() + 1);

  switch (filter) {
    case 'today':
      return { start: today, endExclusive: endToday };
    case 'this_week': {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      return { start: weekStart, endExclusive: weekEnd };
    }
    case 'this_month':
      return { start: new Date(y, m, 1), endExclusive: new Date(y, m + 1, 1) };
    case 'last_month': {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      return { start: new Date(ly, lm, 1), endExclusive: new Date(y, m, 1) };
    }
    case 'last_3_months':
      return { start: new Date(y, m - 3, 1), endExclusive: endToday };
    default:
      return null;
  }
}

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function isWonSalesActivityStatus(status: string | null | undefined): boolean {
  const n = normalizeToken(status);
  return n === 'won' || n === 'converted';
}

export function isOngoingSalesActivityStatus(status: string | null | undefined): boolean {
  const n = normalizeToken(status);
  return n === 'active' || n === 'negotiating' || n === 'follow up';
}

export function isLostSalesActivityStatus(status: string | null | undefined): boolean {
  return normalizeToken(status) === 'lost';
}

export function matchesSalesActivityDateFilter(
  activity: SalesActivity,
  dateFilter: SalesActivitiesDateFilter,
): boolean {
  if (dateFilter === 'all') return true;
  const range = getSalesActivityDateRange(dateFilter);
  if (!range) return true;

  const activityDate = parseSalesActivityDate(activity);
  if (!activityDate) return false;

  return activityDate >= range.start && activityDate < range.endExclusive;
}

export function filterSalesActivities(
  activities: SalesActivity[],
  filters: SalesActivitiesFiltersState,
): SalesActivity[] {
  const searchLower = filters.search.trim().toLowerCase();

  return activities.filter((activity) => {
    if (searchLower) {
      const client = (activity.client_name ?? '').toLowerCase();
      const phone = String((activity as Record<string, unknown>).client_phone ?? '').toLowerCase();
      const email = String((activity as Record<string, unknown>).client_email ?? '').toLowerCase();
      const description = String((activity as Record<string, unknown>).description ?? '').toLowerCase();
      const activityType = activityTypeSearchText(activity.activity_type);
      if (
        !client.includes(searchLower) &&
        !phone.includes(searchLower) &&
        !email.includes(searchLower) &&
        !description.includes(searchLower) &&
        !activityType.includes(searchLower)
      ) {
        return false;
      }
    }

    if (filters.status !== 'all' && normalizeToken(activity.status) !== normalizeToken(filters.status)) {
      return false;
    }

    if (filters.type !== 'all' && normalizeToken(activity.activity_type) !== normalizeToken(filters.type)) {
      return false;
    }

    if (filters.payment !== 'all') {
      const pm = normalizeToken(activity.payment_method);
      if (pm !== normalizeToken(filters.payment)) return false;
    }

    if (!matchesSalesActivityDateFilter(activity, filters.date)) {
      return false;
    }

    return true;
  });
}
