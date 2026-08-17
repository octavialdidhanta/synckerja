import type { CustomerVisitRow } from './customerVisit.types';

export type TodaysMatchedVisitWinner = Pick<
  CustomerVisitRow,
  'id' | 'lead_id' | 'visit_date' | 'status' | 'match_status' | 'sales_activity_id' | 'created_at'
>;

function isCompletedMatchedToday(
  visit: TodaysMatchedVisitWinner,
  leadId: string,
  todayYmd: string,
): boolean {
  return (
    visit.match_status === 'matched' &&
    visit.status === 'completed' &&
    visit.lead_id === leadId &&
    visit.visit_date === todayYmd
  );
}

/** Prefer a paid visit, else earliest created_at (stable by id). */
export function pickTodaysMatchedVisitWinner(
  visits: TodaysMatchedVisitWinner[],
  leadId: string,
  todayYmd: string,
): TodaysMatchedVisitWinner | null {
  const candidates = visits.filter((visit) => isCompletedMatchedToday(visit, leadId, todayYmd));
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const aPaid = a.sales_activity_id ? 1 : 0;
    const bPaid = b.sales_activity_id ? 1 : 0;
    if (aPaid !== bPaid) return bPaid - aPaid;
    const byCreated = a.created_at.localeCompare(b.created_at);
    if (byCreated !== 0) return byCreated;
    return a.id.localeCompare(b.id);
  })[0] ?? null;
}

export function findTodaysMatchedVisit(
  visits: TodaysMatchedVisitWinner[],
  leadId: string,
  todayYmd: string,
): TodaysMatchedVisitWinner | null {
  if (!leadId || !todayYmd) return null;
  return pickTodaysMatchedVisitWinner(visits, leadId, todayYmd);
}
