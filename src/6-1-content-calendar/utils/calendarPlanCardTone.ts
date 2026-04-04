/**
 * Calendar card color tone: pipeline stage, optionally overridden by production_status
 * (Production Need Review = gray, Production Revision = dark red — distinct from "Not Approved" red).
 */
export type CalendarCardTone =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'prod-need-review'
  | 'prod-request-revision';

export function getCalendarPlanCardTone(plan: {
  approved?: boolean;
  production_approved?: boolean;
  done?: boolean;
  production_status?: string | null;
}): CalendarCardTone {
  const approved = plan?.approved === true;
  const productionApproved = plan?.production_approved === true;
  const done = plan?.done === true;
  const prod = String(plan?.production_status ?? '').trim();

  const isCompletedPipeline = approved && productionApproved && done;

  if (!isCompletedPipeline) {
    if (prod === 'Need Review') return 'prod-need-review';
    if (prod === 'Request Revision') return 'prod-request-revision';
  }

  if (!approved && !productionApproved && !done) return 'red';
  if (approved && !productionApproved && !done) return 'orange';
  if (approved && productionApproved && !done) return 'yellow';
  if (approved && productionApproved && done) return 'green';
  return 'blue';
}
