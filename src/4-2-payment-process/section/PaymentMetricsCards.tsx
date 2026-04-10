import type { PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { TrendingUp, Clock, CheckCircle, CreditCard } from 'lucide-react';
import { computePaymentMetricStats } from '../utils/paymentUtils';

type PaymentMetricsCardsProps = {
  requests: PurchaseRequest[];
};

export const PaymentMetricsCards = ({ requests }: PaymentMetricsCardsProps) => {
  const s = computePaymentMetricStats(requests);

  const metrics = {
    readyToPay: {
      count: s.readyToPay,
      amount: s.readyToPayAmount,
      icon: TrendingUp,
      color: 'text-brand-blue',
      bgColor: 'bg-brand-blue/10',
      accentColor: 'bg-brand-blue',
      label: 'Ready to Pay'
    },
    pending: {
      count: s.pendingPayment,
      amount: s.pendingPaymentAmount,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      accentColor: 'bg-amber-500',
      label: 'Pending Payment'
    },
    paid: {
      count: s.paid,
      amount: s.paidAmount,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      accentColor: 'bg-green-500',
      label: 'Paid'
    },
    processing: {
      count: s.processing,
      amount: s.processingAmount,
      icon: CreditCard,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      accentColor: 'bg-purple-500',
      label: 'Processing'
    }
  };

  const cards = ['readyToPay', 'pending', 'paid', 'processing'] as const;

  return (
    <>
      {cards.map((key) => {
        const metric = metrics[key];
        const Icon = metric.icon;
        
        return (
          <div key={key} className="bg-card rounded-md border border-border p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs font-medium text-gray-500 mb-1">{metric.label}</div>
                <div className="text-lg font-bold text-gray-900">{metric.count}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatToRupiah(metric.amount)}
                </div>
              </div>
              <div className={`p-2 rounded-md ${metric.bgColor}`}>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
