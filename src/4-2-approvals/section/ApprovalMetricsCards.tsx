import type { PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { TrendingUp, Clock, CheckCircle, RotateCcw } from 'lucide-react';
import {
  computeApprovalsMetricAmounts,
  computeApprovalsMetricCounts,
} from '../utils/approvalUtils';

type ApprovalMetricsCardsProps = {
  requests?: PurchaseRequest[];
};

export const ApprovalMetricsCards = ({ requests = [] }: ApprovalMetricsCardsProps) => {
  const { totalRequests, pendingReview, approved, recurring } =
    computeApprovalsMetricCounts(requests);
  const { totalAmount, pendingAmount, approvedAmount, recurringAmount } =
    computeApprovalsMetricAmounts(requests);

  const metrics = [
    {
      key: 'total',
      title: 'Total Requests',
      value: totalRequests.toString(),
      subtitle: formatToRupiah(totalAmount),
      icon: TrendingUp,
      iconColor: 'text-brand-blue',
      bgColor: 'bg-brand-blue/10',
    },
    {
      key: 'pending',
      title: 'Pending Review',
      value: pendingReview.toString(),
      subtitle: formatToRupiah(pendingAmount),
      icon: Clock,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      key: 'approved',
      title: 'Approved',
      value: approved.toString(),
      subtitle: formatToRupiah(approvedAmount),
      icon: CheckCircle,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      key: 'recurring',
      title: 'Recurring',
      value: recurring.toString(),
      subtitle: formatToRupiah(recurringAmount),
      icon: RotateCcw,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <>
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div key={metric.key} className="rounded-md border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="mb-1 text-xs font-medium text-muted-foreground">{metric.title}</div>
                <div className="text-lg font-bold text-foreground">{metric.value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{metric.subtitle}</div>
              </div>
              <div className={`rounded-md p-2 ${metric.bgColor}`}>
                <Icon className={`h-4 w-4 ${metric.iconColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
