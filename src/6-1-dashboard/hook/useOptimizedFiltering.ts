
import { useMemo } from 'react';
import { ContentPlan } from '../types/social-media';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { planMatchesContentDatePreset, type ContentTableDatePreset } from '../lib/contentDateFilter';
import { normalizeStatusContent, STATUS_CONTENT_FOR_ADS } from '../lib/statusContent';

/** Normalize status/production_status for comparison (trim, null/undefined -> empty). */
function norm(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).trim();
}

/** Case-insensitive match for known status values (DB might store "need review", "Need Review", etc.). */
function statusEq(got: string, expected: string): boolean {
  return norm(got).toLowerCase() === norm(expected).toLowerCase();
}

/** True if plan is in "Content Need Review" (content planner need review, no drive link yet). */
function isContentNeedReview(plan: ContentPlan): boolean {
  const status = norm(plan.status);
  const hasEmptyGoogleDriveLink =
    plan.google_drive_link == null || String(plan.google_drive_link).trim() === '';
  return (
    statusEq(status, 'Need Review') &&
    plan.approved !== true &&
    hasEmptyGoogleDriveLink &&
    plan.production_approved !== true &&
    plan.done !== true
  );
}

/** True if plan is in "Content Revision" (content planner request revision, no drive link). */
function isContentRevision(plan: ContentPlan): boolean {
  const status = norm(plan.status);
  const hasEmptyGoogleDriveLink =
    plan.google_drive_link == null || String(plan.google_drive_link).trim() === '';
  return (
    (statusEq(status, 'Request Revision') || statusEq(status, 'Request Revisi')) &&
    plan.approved !== true &&
    hasEmptyGoogleDriveLink &&
    plan.production_approved !== true &&
    plan.done !== true
  );
}

/** True if plan is "Ready To Post" (both approved, has link, not done). */
function isReadyToPost(plan: ContentPlan): boolean {
  const hasGoogleDriveLink =
    plan.google_drive_link != null && String(plan.google_drive_link).trim().length > 0;
  return (
    plan.approved === true &&
    plan.production_approved === true &&
    hasGoogleDriveLink &&
    plan.done === false
  );
}

/** True if plan has Production Status = "Need Review" (filter by kolom Production Status saja). */
function isProdNeedReview(plan: ContentPlan): boolean {
  return statusEq(plan.production_status ?? '', 'Need Review');
}

/** True if plan has Production Status = "Request Revision" / "Request Revisi" (filter by kolom Production Status saja). */
function isProdRevision(plan: ContentPlan): boolean {
  const prodStatus = norm(plan.production_status);
  return statusEq(prodStatus, 'Request Revision') || statusEq(prodStatus, 'Request Revisi');
}

export const useOptimizedFiltering = (
  contentPlans: ContentPlan[],
  searchTerm: string,
  statusFilter: string,
  selectedMonth?: Date,
  serviceFilter?: string,
  datePreset: ContentTableDatePreset = 'month',
) => {
  return useMemo(() => {
    const lowerSearchTerm = searchTerm.trim().toLowerCase();
    const effectiveStatusFilter = (statusFilter || '').trim() || 'all';
    const now = new Date();

    // Prepare month filter range if selectedMonth is provided
    let monthStart: Date | null = null;
    let monthEnd: Date | null = null;
    if (selectedMonth) {
      monthStart = startOfMonth(selectedMonth);
      monthEnd = endOfMonth(selectedMonth);
    }

    const result = contentPlans.filter(plan => {
      let matchesMonth = true;
      if (datePreset === 'today' || datePreset === 'yesterday' || datePreset === 'this_week') {
        matchesMonth = planMatchesContentDatePreset(plan.post_date, datePreset, now);
      } else if (monthStart && monthEnd && plan.post_date) {
        try {
          const planDate = new Date(plan.post_date);
          matchesMonth = isWithinInterval(planDate, { start: monthStart, end: monthEnd });
        } catch {
          matchesMonth = true;
        }
      }

      // Service filter
      let matchesService = true;
      if (serviceFilter && serviceFilter !== 'all') {
        matchesService = plan.service_id === serviceFilter;
      }

      // Search filter
      const serviceName = plan.service?.name || '';
      const matchesSearch =
        !lowerSearchTerm ||
        (plan.title?.toLowerCase().includes(lowerSearchTerm) ||
          plan.brief?.toLowerCase().includes(lowerSearchTerm) ||
          serviceName.toLowerCase().includes(lowerSearchTerm));

      // Status filter
      let matchesStatus = true;
      if (effectiveStatusFilter !== 'all') {
        switch (effectiveStatusFilter) {
          case 'Ready To Post':
            matchesStatus = isReadyToPost(plan);
            break;
          case 'Content Need Review':
            matchesStatus = isContentNeedReview(plan);
            break;
          case 'Content Revision':
            matchesStatus = isContentRevision(plan);
            break;
          case 'Prod Revision':
            matchesStatus = isProdRevision(plan);
            break;
          case 'Prod Need Review':
            matchesStatus = isProdNeedReview(plan);
            break;
          case STATUS_CONTENT_FOR_ADS:
            matchesStatus = normalizeStatusContent(plan.status_content) === STATUS_CONTENT_FOR_ADS;
            break;
          default:
            matchesStatus =
              statusEq(plan.status, effectiveStatusFilter) ||
              statusEq(plan.production_status ?? '', effectiveStatusFilter);
        }
      }

      return matchesMonth && matchesSearch && matchesStatus && matchesService;
    });
    return result;
  }, [contentPlans, searchTerm, statusFilter, selectedMonth, serviceFilter, datePreset]);
};
