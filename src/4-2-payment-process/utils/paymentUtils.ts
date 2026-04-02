import { PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { PaymentFiltersType } from '../section/PaymentFilters';

export const filterPaymentRequests = (
  requests: PurchaseRequest[],
  filters: PaymentFiltersType
): PurchaseRequest[] => {
  // Filter only approved requests (include both paid and unpaid for history)
  const approvedRequests = requests.filter(req => req.status === 'approved');
  
  return approvedRequests.filter((request) => {
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
