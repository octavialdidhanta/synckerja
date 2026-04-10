import { isSameMonth, isSameYear, subMonths } from 'date-fns';
import { PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { PaymentFiltersType } from '../section/PaymentFilters';

function matchesPaymentPeriod(request: PurchaseRequest, period: string | undefined): boolean {
  if (!period || period === 'all') return true;
  const raw = request.approved_at || request.created_at;
  if (!raw) return false;
  const date = new Date(raw);
  const now = new Date();
  if (period === 'this_month') return isSameMonth(date, now) && isSameYear(date, now);
  if (period === 'last_month') {
    const ref = subMonths(now, 1);
    return isSameMonth(date, ref) && isSameYear(date, ref);
  }
  if (period === 'this_year') return isSameYear(date, now);
  return true;
}

/** Metrik dashboard payment (desktop cards + mobile carousel) — satu definisi dengan `PaymentMetricsCards`. */
export function computePaymentMetricStats(requests: PurchaseRequest[]) {
  const readyList = requests.filter((req) => req.status === 'approved' && !req.paid_at);
  const pendingList = requests.filter(
    (req) => req.status === 'approved' && !req.paid_at && req.payment_status !== 'processing',
  );
  const paidList = requests.filter((req) => !!req.paid_at);
  const processingList = requests.filter(
    (req) => req.status === 'approved' && req.payment_status === 'processing',
  );
  const sum = (list: PurchaseRequest[]) => list.reduce((s, r) => s + (r.amount_idr || 0), 0);
  return {
    readyToPay: readyList.length,
    readyToPayAmount: sum(readyList),
    pendingPayment: pendingList.length,
    pendingPaymentAmount: sum(pendingList),
    paid: paidList.length,
    paidAmount: sum(paidList),
    processing: processingList.length,
    processingAmount: sum(processingList),
  };
}

export const filterPaymentRequests = (
  requests: PurchaseRequest[],
  filters: PaymentFiltersType
): PurchaseRequest[] => {
  // Filter only approved requests (include both paid and unpaid for history)
  const approvedRequests = requests.filter(req => req.status === 'approved');
  
  return approvedRequests.filter((request) => {
    if (!matchesPaymentPeriod(request, filters.period)) {
      return false;
    }

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
      if (filters.status === 'paid' && (!request.paid_at && request.payment_status !== 'paid')) {
        return false;
      }
      if (filters.status === 'processing' && request.payment_status !== 'processing') {
        return false;
      }
      if (filters.status === 'pending' && (request.paid_at || request.payment_status === 'paid' || request.payment_status === 'processing')) {
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

export const getUniquePaymentTypes = (requests: PurchaseRequest[]): string[] => {
  const types = new Set<string>();
  requests.forEach((request) => {
    if (request.request_type) {
      types.add(request.request_type);
    }
  });
  return Array.from(types).sort();
};

export const getUniquePaymentDepartments = (requests: PurchaseRequest[]): string[] => {
  const departments = new Set<string>();
  requests.forEach((request) => {
    if (request.department_name) {
      departments.add(request.department_name);
    }
  });
  return Array.from(departments).sort();
};
