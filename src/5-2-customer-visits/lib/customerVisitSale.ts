import type { CustomerVisitRow, CustomerVisitSaleEmbed } from './customerVisit.types';

export type { CustomerVisitSaleEmbed };
export type CustomerVisitsSaleFilter = 'all' | 'paid' | 'unpaid';

export function customerVisitSale(row: Pick<CustomerVisitRow, 'sales_activities'>): CustomerVisitSaleEmbed | null {
  const embed = row.sales_activities;
  if (!embed) return null;
  const sale = Array.isArray(embed) ? embed[0] ?? null : embed;
  if (!sale?.id) return null;
  return sale;
}

export function isVisitPaid(visit: { sales_activity_id?: string | null }): boolean {
  return Boolean(visit.sales_activity_id);
}

export function canStartStoreCheckout(
  visit: Pick<CustomerVisitRow, 'match_status' | 'status' | 'lead_id' | 'visit_date'>,
  todayYmd: string,
): boolean {
  return (
    visit.match_status === 'matched' &&
    visit.status === 'completed' &&
    Boolean(visit.lead_id) &&
    visit.visit_date === todayYmd
  );
}

export function canViewVisitReceipt(visit: { sales_activity_id?: string | null }): boolean {
  return isVisitPaid(visit);
}

export function matchesVisitSaleFilter(
  visit: { sales_activity_id?: string | null },
  sale: CustomerVisitsSaleFilter,
): boolean {
  if (sale === 'all') return true;
  if (sale === 'paid') return isVisitPaid(visit);
  return !isVisitPaid(visit);
}

export function visitTickets(
  row: Pick<CustomerVisitRow, 'sales_activities' | 'store_tickets' | 'sales_activity_id'>,
): CustomerVisitSaleEmbed[] {
  if (row.store_tickets && row.store_tickets.length > 0) return row.store_tickets;
  const sale = customerVisitSale(row);
  return sale ? [sale] : [];
}

export function visitSaleAmount(
  row: Pick<CustomerVisitRow, 'sales_activities' | 'store_tickets' | 'sales_activity_id'>,
): number | null {
  const total = visitTickets(row).reduce((sum, ticket) => {
    const amount = Number(ticket.total_amount);
    return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
  }, 0);
  return total > 0 ? total : null;
}

export function todayPaidSummary(
  visits: Array<
    Pick<
      CustomerVisitRow,
      'visit_date' | 'status' | 'sales_activity_id' | 'sales_activities' | 'store_tickets'
    >
  >,
  todayYmd: string,
): { count: number; total: number } {
  let count = 0;
  let total = 0;
  for (const visit of visits) {
    if (visit.status !== 'completed' || visit.visit_date !== todayYmd) continue;
    const tickets = visitTickets(visit);
    if (tickets.length === 0) {
      if (!isVisitPaid(visit)) continue;
      count += 1;
      continue;
    }
    count += tickets.length;
    total += visitSaleAmount(visit) ?? 0;
  }
  return { count, total };
}

function ticketAmount(ticket: CustomerVisitSaleEmbed): number {
  const amount = Number(ticket.total_amount);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function isCashTicket(ticket: CustomerVisitSaleEmbed): boolean {
  return String(ticket.payment_method ?? '').trim().toLowerCase() === 'cash';
}

function ticketIsToday(ticket: CustomerVisitSaleEmbed, visitDate: string, todayYmd: string): boolean {
  const ticketDate = String(ticket.date ?? '').trim();
  if (ticketDate) return ticketDate === todayYmd;
  return visitDate === todayYmd;
}

export function todayCashSummary(
  visits: Array<
    Pick<
      CustomerVisitRow,
      'visit_date' | 'status' | 'sales_activity_id' | 'sales_activities' | 'store_tickets'
    >
  >,
  todayYmd: string,
): { count: number; total: number } {
  let count = 0;
  let total = 0;
  for (const visit of visits) {
    if (visit.status !== 'completed') continue;
    for (const ticket of visitTickets(visit)) {
      if (!isCashTicket(ticket) || !ticketIsToday(ticket, visit.visit_date, todayYmd)) continue;
      const amount = ticketAmount(ticket);
      if (amount <= 0) continue;
      count += 1;
      total += amount;
    }
  }
  return { count, total };
}
