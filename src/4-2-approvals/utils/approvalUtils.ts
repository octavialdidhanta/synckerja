import { PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { ApprovalFiltersType } from '../section/ApprovalFilters';

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
