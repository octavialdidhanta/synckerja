import { PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { ApprovalFiltersType } from '../section/ApprovalFilters';

/** Shared counts for dashboard metrics + mobile carousel (keep in sync with `ApprovalMetricsCards`). */
export function computeApprovalsMetricCounts(requests: PurchaseRequest[]) {
  return {
    totalRequests: requests.length,
    pendingReview: requests.filter(
      (req) => req.status === 'pending_approval' || req.status === 'submitted',
    ).length,
    approved: requests.filter((req) => req.status === 'approved').length,
    recurring: requests.filter((req) => req.is_recurring).length,
  };
}

/** Amount totals aligned with `computeApprovalsMetricCounts` (shared desktop metrics + mobile carousel). */
export function computeApprovalsMetricAmounts(requests: PurchaseRequest[]) {
  const sumAmount = (list: PurchaseRequest[]) =>
    list.reduce((s, r) => s + (r.amount_idr || 0), 0);
  const pendingList = requests.filter(
    (r) => r.status === 'pending_approval' || r.status === 'submitted',
  );
  const approvedList = requests.filter((r) => r.status === 'approved');
  const recurringList = requests.filter((r) => r.is_recurring);
  return {
    totalAmount: sumAmount(requests),
    pendingAmount: sumAmount(pendingList),
    approvedAmount: sumAmount(approvedList),
    recurringAmount: sumAmount(recurringList),
  };
}

export const filterRequests = (
  requests: PurchaseRequest[],
  filters: ApprovalFiltersType
): PurchaseRequest[] => {
  return requests.filter((request) => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = 
        request.request_title?.toLowerCase().includes(searchLower) ||
        request.description?.toLowerCase().includes(searchLower) ||
        request.requester_name?.toLowerCase().includes(searchLower) ||
        request.department_name?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'pending_approval' || filters.status === 'submitted') {
        if (request.status !== 'pending_approval' && request.status !== 'submitted') {
          return false;
        }
      } else if (request.status !== filters.status) {
        return false;
      }
    }

    // Type filter
    if (filters.type && filters.type !== 'all') {
      if (filters.type === 'purchase' && request.request_type !== 'purchase') {
        return false;
      }
      if (filters.type === 'reimbursement' && request.request_type !== 'reimbursement') {
        return false;
      }
    }

    // Department filter
    if (filters.department && filters.department !== 'all') {
      if (request.department_name?.toLowerCase() !== filters.department.toLowerCase()) {
        return false;
      }
    }

    return true;
  });
};

export const getUniqueRequestTypes = (requests: PurchaseRequest[]): string[] => {
  const types = new Set<string>();
  requests.forEach((request) => {
    if (request.request_type) {
      types.add(request.request_type);
    }
  });
  return Array.from(types).sort();
};

export const getUniqueDepartments = (requests: PurchaseRequest[]): string[] => {
  const departments = new Set<string>();
  requests.forEach((request) => {
    if (request.department_name) {
      departments.add(request.department_name);
    }
  });
  return Array.from(departments).sort();
};
