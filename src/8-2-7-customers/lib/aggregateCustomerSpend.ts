import { getLocalDateYmd } from '@/shared/lib/date/getLocalDateYmd';

export type CustomerSpendActivity = {
  lead_id: string;
  date: string | null;
  total_amount: number | null;
};

export type CustomerSpendTotals = {
  thisMonth: number;
  thisYear: number;
  lifetime: number;
  firstPurchaseDate: string | null;
};

export type CustomerSinceInput = {
  convertedAt: string | null;
  createdAt: string | null;
  firstPurchaseDate: string | null;
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function monthRangeYmd(anchor: Date): { start: string; end: string } {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const start = `${year}-${pad2(month + 1)}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${pad2(month + 1)}-${pad2(lastDay)}`;
  return { start, end };
}

export function yearRangeYmd(anchor: Date): { start: string; end: string } {
  const year = anchor.getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function normalizeActivityDate(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export function aggregateCustomerSpend(
  activities: CustomerSpendActivity[],
  anchor: Date = new Date(),
): Map<string, CustomerSpendTotals> {
  const month = monthRangeYmd(anchor);
  const year = yearRangeYmd(anchor);
  const totals = new Map<string, CustomerSpendTotals>();

  for (const activity of activities) {
    const leadId = activity.lead_id?.trim();
    if (!leadId) continue;
    const amount = Number(activity.total_amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const date = normalizeActivityDate(activity.date);
    const current = totals.get(leadId) ?? {
      thisMonth: 0,
      thisYear: 0,
      lifetime: 0,
      firstPurchaseDate: null,
    };

    current.lifetime += amount;
    if (date) {
      if (date >= month.start && date <= month.end) current.thisMonth += amount;
      if (date >= year.start && date <= year.end) current.thisYear += amount;
      if (!current.firstPurchaseDate || date < current.firstPurchaseDate) {
        current.firstPurchaseDate = date;
      }
    }

    totals.set(leadId, current);
  }

  return totals;
}

export function resolveCustomerSince(input: CustomerSinceInput): string | null {
  if (input.convertedAt) {
    const converted = new Date(input.convertedAt);
    if (!Number.isNaN(converted.getTime())) return getLocalDateYmd(converted);
  }
  if (input.firstPurchaseDate) return input.firstPurchaseDate;
  if (input.createdAt) {
    const created = new Date(input.createdAt);
    if (!Number.isNaN(created.getTime())) return getLocalDateYmd(created);
  }
  return null;
}
