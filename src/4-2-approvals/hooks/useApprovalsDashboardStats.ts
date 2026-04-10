import { useMemo } from 'react';
import { usePurchaseRequests } from '@/9-request-form/hooks/usePurchaseRequests';
import { computeApprovalsMetricCounts } from '../utils/approvalUtils';

export function useApprovalsDashboardStats() {
  const { data: requests = [], isLoading } = usePurchaseRequests();
  const stats = useMemo(() => computeApprovalsMetricCounts(requests), [requests]);
  return { isLoading, ...stats };
}
