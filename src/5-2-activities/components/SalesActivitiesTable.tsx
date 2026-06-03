import React, { memo, useMemo, useCallback } from 'react';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { SalesActivitiesActionsDropdown } from './SalesActivitiesActionsDropdown';
import { SalesActivitiesTableFooter } from './SalesActivitiesTableFooter';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import type { SalesActivity } from '@/shared/hooks/organized/sales';
import { isWonSalesActivityStatus } from '../utils/salesActivitiesFilterUtils';

interface SalesActivitiesTableProps {
  activities: SalesActivity[];
  /** Total rows before client-side filters (for footer “Showing X of Y”). */
  totalUnfilteredCount?: number;
  onUpdate: () => void;
  onEdit: (activity: SalesActivity) => void;
  onViewDetails: (activity: SalesActivity) => void;
  onDelete: (activity: SalesActivity) => void;
  onUpdatePayment: (activity: SalesActivity) => void;
  onCheckHistory: (activity: SalesActivity) => void;
  selectedStatus?: string;
}

const getStatusColor = (status: string) => {
  switch (status?.trim().toLowerCase()) {
    case 'won':
    case 'converted':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'lost':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'negotiating':
      return 'bg-brand-blue-soft text-brand-blue-deep border-brand-blue/25';
    case 'active':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'follow up':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getActivityTypeColor = (type: string) => {
  switch (type?.trim().toLowerCase()) {
    case 'demo':
      return 'bg-brand-blue-soft text-brand-blue-deep border-brand-blue/25';
    case 'meeting':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'call':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'proposal':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'closing':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'lead conversion':
    case 'visit':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const ACTIVITY_BADGE_CLASS =
  'inline-flex max-w-full shrink-0 whitespace-nowrap border px-2 py-0.5 text-xs font-medium leading-snug';

const formatActivityTypeLabel = (type: string | null | undefined) => {
  if (!type) return '-';
  return type.replace(/_/g, ' ');
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return '-';
  }
};

/** Row total (items / activity total). */
function getActivityRowTotal(activity: SalesActivity): number {
  const n = Number(activity.total_amount ?? activity.amount ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Amount paid via `sales_activity_payments` (DB trigger keeps `total_paid_amount` in sync).
 * Modal "Payment History" updates this; it does not set `is_down_payment`.
 */
function getActivityInstallmentPaid(activity: SalesActivity): number {
  const raw = (activity as Record<string, unknown>).total_paid_amount;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Remaining balance for display: installments first, else legacy down payment on the activity row. */
function getActivityRemainingDisplay(activity: SalesActivity): number {
  const total = getActivityRowTotal(activity);
  const paidInstallments = getActivityInstallmentPaid(activity);
  if (paidInstallments > 0) {
    return Math.max(0, total - paidInstallments);
  }
  if (activity.is_down_payment && activity.down_payment_amount != null) {
    const down = Number(activity.down_payment_amount);
    if (Number.isFinite(down) && down >= 0 && total > 0) {
      return Math.max(0, total - down);
    }
  }
  return total;
}

function isActivityFullyPaidForActions(activity: SalesActivity): boolean {
  const total = getActivityRowTotal(activity);
  if (total <= 0) return false;
  return getActivityRemainingDisplay(activity) <= 0;
}

// Memoized row component for performance
const ActivityRow = memo(({ 
  activity, 
  onEdit,
  onViewDetails,
  onDelete,
  onUpdatePayment,
  onCheckHistory
}: {
  activity: SalesActivity;
  onEdit: (activity: SalesActivity) => void;
  onViewDetails: (activity: SalesActivity) => void;
  onDelete: (activity: SalesActivity) => void;
  onUpdatePayment: (activity: SalesActivity) => void;
  onCheckHistory: (activity: SalesActivity) => void;
}) => {
  const handleViewDetails = useCallback(() => {
    onViewDetails(activity);
  }, [activity, onViewDetails]);

  const handleEdit = useCallback(() => {
    onEdit(activity);
  }, [activity, onEdit]);

  const handleDelete = useCallback(() => {
    onDelete(activity);
  }, [activity, onDelete]);

  const handleUpdatePayment = useCallback(() => {
    onUpdatePayment(activity);
  }, [activity, onUpdatePayment]);

  const handleCheckHistory = useCallback(() => {
    onCheckHistory(activity);
  }, [activity, onCheckHistory]);

  const installmentPaid = getActivityInstallmentPaid(activity);
  const rowTotal = getActivityRowTotal(activity);
  const remainingDisplay = getActivityRemainingDisplay(activity);

  return (
    <TableRow className="hover:bg-gray-50/50 h-12 transition-colors">
      <TableCell className="w-40 px-3 text-sm">
        <div>
          <span className="truncate block font-medium text-gray-900" title={activity.client_name || '-'}>
            {activity.client_name || '-'}
          </span>
          {activity.client_phone && (
            <span className="text-xs text-gray-500 truncate block" title={activity.client_phone}>
              {activity.client_phone}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="w-48 px-3 text-sm">
        <div>
          {activity.services?.name && (
            <span className="truncate block font-medium text-gray-900" title={activity.services.name}>
              {activity.services.name}
            </span>
          )}
          {activity.sub_services?.name && (
            <span className="text-xs text-gray-500 truncate block" title={activity.sub_services.name}>
              {activity.sub_services.name}
            </span>
          )}
          {!activity.services?.name && !activity.sub_services?.name && (
            <span className="text-xs text-gray-500">-</span>
          )}
        </div>
      </TableCell>
      <TableCell className="w-36 px-3 text-sm">
        <div>
          {(activity.total_amount || activity.amount) && (
            <span className="truncate block font-medium text-gray-900">
              {formatToRupiah(activity.total_amount || activity.amount)}
            </span>
          )}
          {installmentPaid > 0 ? (
            remainingDisplay <= 0 ? (
              <span className="truncate block text-xs font-medium text-green-600">PAID</span>
            ) : (
              <span className="text-xs text-gray-500 truncate block">
                Remaining: {formatToRupiah(remainingDisplay)}
              </span>
            )
          ) : !activity.is_down_payment ? (
            <span className="text-xs text-gray-500 truncate block">
              Remaining: {formatToRupiah(rowTotal)}
            </span>
          ) : (
            activity.down_payment_amount && (activity.total_amount || activity.amount) && (
              <span className="text-xs text-gray-500 truncate block">
                {activity.down_payment_amount === (activity.total_amount || activity.amount)
                  ? "PAID"
                  : `Remaining: ${formatToRupiah((activity.total_amount || activity.amount) - activity.down_payment_amount)}`
                }
              </span>
            )
          )}
        </div>
      </TableCell>
      <TableCell className="w-40 px-3 text-sm">
        <div>
          {installmentPaid > 0 ? (
            <div>
              <span className="truncate block font-medium text-gray-900">
                {remainingDisplay <= 0 ? 'Paid' : 'Partial'}
              </span>
              <span className="text-xs text-gray-500 truncate block">
                Paid: {formatToRupiah(installmentPaid)}
              </span>
            </div>
          ) : !activity.is_down_payment ? (
            <span className="truncate block text-gray-500">Pending</span>
          ) : (
            <div>
              {activity.payment_method && (
                <span className="truncate block font-medium text-gray-900" title={activity.payment_method.replace('_', ' ')}>
                  {activity.payment_method.replace('_', ' ')}
                </span>
              )}
              {activity.down_payment_amount && (
                <span className="text-xs text-gray-500 truncate block">
                  Down: {formatToRupiah(activity.down_payment_amount)}
                </span>
              )}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="w-40 px-3 text-sm">
        {activity.description ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate block text-gray-600 cursor-pointer" title={activity.description}>
                  {activity.description?.substring(0, 30) || '-'}...
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="whitespace-normal break-words">{activity.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-gray-500">-</span>
        )}
      </TableCell>
      <TableCell className="w-32 px-3 text-sm whitespace-nowrap">
        {formatDate(activity.date)}
      </TableCell>
      <TableCell className="min-w-[7.5rem] w-36 px-3">
        <Badge
          className={`${getActivityTypeColor(activity.activity_type)} ${ACTIVITY_BADGE_CLASS}`}
          title={formatActivityTypeLabel(activity.activity_type)}
        >
          {formatActivityTypeLabel(activity.activity_type)}
        </Badge>
      </TableCell>
      <TableCell className="w-32 px-3">
        <Badge className={`${getStatusColor(activity.status)} ${ACTIVITY_BADGE_CLASS}`}>
          {activity.status?.replace(/_/g, ' ').toUpperCase() || '-'}
        </Badge>
      </TableCell>
      <TableCell className="w-24 px-3">
        <SalesActivitiesActionsDropdown
          onViewDetails={handleViewDetails}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onUpdatePayment={handleUpdatePayment}
          onCheckHistory={handleCheckHistory}
          isPaid={
            activity.is_paid ||
            isActivityFullyPaidForActions(activity) ||
            activity.down_payment_amount === (activity.total_amount || activity.amount)
          }
        />
      </TableCell>
    </TableRow>
  );
});

ActivityRow.displayName = 'ActivityRow';

export const SalesActivitiesTable = memo(({ 
  activities,
  totalUnfilteredCount,
  onUpdate, 
  onEdit,
  onViewDetails,
  onDelete,
  onUpdatePayment, 
  onCheckHistory,
  selectedStatus = 'all'
}: SalesActivitiesTableProps) => {
  const totalCount = totalUnfilteredCount ?? activities.length;
  // Memoize the table headers to prevent re-renders
  const tableHeaders = useMemo(() => [
    { key: 'client', label: 'Client', width: 'w-40' },
    { key: 'service', label: 'Service', width: 'w-48' },
    { key: 'amount', label: 'Amount', width: 'w-36' },
    { key: 'payment', label: 'Payment', width: 'w-40' },
    { key: 'description', label: 'Description', width: 'w-40' },
    { key: 'date', label: 'Date', width: 'w-32' },
    { key: 'type', label: 'Type', width: 'min-w-[7.5rem] w-36' },
    { key: 'status', label: 'Status', width: 'w-32' },
    { key: 'actions', label: 'Actions', width: 'w-24' },
  ], []);

  const renderActivityRows = useMemo(() => (
    activities.map((activity) => (
      <ActivityRow
        key={activity.id}
        activity={activity}
        onEdit={onEdit}
        onViewDetails={onViewDetails}
        onDelete={onDelete}
        onUpdatePayment={onUpdatePayment}
        onCheckHistory={onCheckHistory}
      />
    ))
  ), [activities, onEdit, onViewDetails, onDelete, onUpdatePayment, onCheckHistory]);

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-hide flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-20 bg-gray-50 shadow-sm">
            <TableRow className="hover:bg-transparent">
              {tableHeaders.map((header) => (
                <TableHead key={header.key} className={`text-xs font-medium text-gray-700 ${header.width} px-3 bg-gray-50 whitespace-nowrap`}>
                  {header.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500 text-sm">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="text-lg">📊</div>
                    <div>No activities found</div>
                    <div className="text-xs text-gray-400">Try adjusting your filters or search terms</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              renderActivityRows
            )}
          </TableBody>
        </table>
      </div>

      <SalesActivitiesTableFooter
        totalActivities={totalCount}
        closedWonActivities={activities.filter((a) => isWonSalesActivityStatus(a.status)).length}
        filteredActivities={activities.length}
        selectedStatus={selectedStatus}
      />
    </div>
  );
});

SalesActivitiesTable.displayName = 'SalesActivitiesTable';
