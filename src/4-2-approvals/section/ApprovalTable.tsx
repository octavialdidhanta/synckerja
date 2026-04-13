import { useState } from 'react';
import type { PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { Badge } from '@/shared/components/ui/badge';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { CreditCard, User, Building, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ApprovalActionsDropdown } from '../components/ApprovalActionsDropdown';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';

const SCROLL_HIDE =
  'scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export type ApprovalTableVariant = 'module' | 'mobileCard';

interface ApprovalTableProps {
  requests: PurchaseRequest[];
  isLoading?: boolean;
  onRefresh?: () => void;
  variant?: ApprovalTableVariant;
  /** Mobile tab dengan rantai flex tinggi: isi scroll mengisi parent, bukan `max-h-[50vh]`. */
  fillScrollHeight?: boolean;
  /** Native mobile approvals: viewport ~10 baris, scroll di dalam (selaras expense dashboard). */
  fixedMobileViewport?: boolean;
}

export const ApprovalTable = ({
  requests,
  isLoading = false,
  variant = 'module',
  fillScrollHeight = false,
  fixedMobileViewport = false,
}: ApprovalTableProps) => {
  const { t } = useAppTranslation();
  const isMobileCard = variant === 'mobileCard';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            {t('approvals.status.approved', 'Approved')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-xs font-medium">
            {t('approvals.status.rejected', 'Rejected')}
          </Badge>
        );
      case 'pending_approval':
      case 'submitted':
        return (
          <Badge className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-xs font-medium text-brand-blue">
            {t('approvals.status.pending', 'Pending')}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-medium">
            {t('approvals.status.draft', 'Draft')}
          </Badge>
        );
    }
  };

  const getTypeDisplay = (request: PurchaseRequest) => {
    if (request.request_type === 'reimbursement') {
      return request.reimbursement_type || t('approvals.type.reimbursement', 'Reimbursement');
    }
    return request.purchase_type || t('approvals.type.purchase', 'Purchase');
  };

  const triggerClassMobile = 'h-10 w-10 touch-manipulation p-0';

  const headerCells = isMobileCard ? (
    <TableRow className="border-b border-white/20 bg-brand-blue hover:bg-brand-blue">
      <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
        {t('approvals.table.request', 'Request')}
      </TableHead>
      <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
        {t('approvals.table.requester', 'Requester')}
      </TableHead>
      <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
        {t('approvals.table.department', 'Department')}
      </TableHead>
      <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
        {t('approvals.table.amount', 'Amount')}
      </TableHead>
      <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
        {t('approvals.table.type', 'Type')}
      </TableHead>
      <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
        {t('approvals.table.status', 'Status')}
      </TableHead>
      <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
        {t('approvals.table.recurring', 'Recurring')}
      </TableHead>
      <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
        {t('approvals.table.requestDate', 'Request Date')}
      </TableHead>
      <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
        {t('approvals.table.approvedDate', 'Approved Date')}
      </TableHead>
      <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
        {t('approvals.table.approvedBy', 'Approved By')}
      </TableHead>
      <TableHead className="h-8 w-16 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
        {t('approvals.table.actions', 'Actions')}
      </TableHead>
    </TableRow>
  ) : (
    <TableRow className="border-b bg-gray-50">
      <TableHead className="h-8 max-w-[280px] w-[280px] whitespace-nowrap px-3 text-xs font-medium">
        Request
      </TableHead>
      <TableHead className="h-8 whitespace-nowrap px-3 text-xs font-medium">Requester</TableHead>
      <TableHead className="h-8 whitespace-nowrap px-3 text-xs font-medium">Department</TableHead>
      <TableHead className="h-8 whitespace-nowrap px-3 text-xs font-medium">Amount</TableHead>
      <TableHead className="h-8 whitespace-nowrap px-3 text-xs font-medium">Type</TableHead>
      <TableHead className="h-8 whitespace-nowrap px-3 text-xs font-medium">Status</TableHead>
      <TableHead className="h-8 whitespace-nowrap px-3 text-xs font-medium">Recurring</TableHead>
      <TableHead className="h-8 whitespace-nowrap px-3 text-xs font-medium">Request Date</TableHead>
      <TableHead className="h-8 whitespace-nowrap px-3 text-xs font-medium">Approved Date</TableHead>
      <TableHead className="h-8 whitespace-nowrap px-3 text-xs font-medium">Approved By</TableHead>
      <TableHead className="h-8 w-16 whitespace-nowrap px-3 text-xs font-medium">Actions</TableHead>
    </TableRow>
  );

  const cellPx = isMobileCard ? 'px-2 py-2' : 'px-3 py-2';
  const requestCellMax = isMobileCard ? 'max-w-[200px] min-w-0' : 'max-w-[280px] w-[280px]';

  const skeletonRows = Array.from({ length: 10 }).map((_, rowIndex) => (
    <TableRow key={rowIndex} className="border-b">
      {Array.from({ length: 11 }).map((__, ci) => (
        <TableCell key={ci} className={cellPx}>
          <Skeleton className="h-4 w-full max-w-[100px]" />
        </TableCell>
      ))}
    </TableRow>
  ));

  const dataRows =
    requests.length === 0 && !isLoading ? (
      <TableRow>
        <TableCell colSpan={11} className={cn('h-16 text-center', isMobileCard ? 'py-8' : '')}>
          <CreditCard className="mx-auto mb-2 h-12 w-12 text-gray-300" />
          <p className="mb-1 text-sm text-gray-500">
            {t('approvals.table.emptyTitle', 'No approval requests found')}
          </p>
          <p className="text-xs text-gray-400">
            {t('approvals.table.emptyHint', 'Create your first approval request to get started')}
          </p>
        </TableCell>
      </TableRow>
    ) : (
      requests.map((request) => (
        <TableRow key={request.id} className={cn('hover:bg-gray-50', isMobileCard && 'hover:bg-muted/30')}>
          <TableCell className={cn('text-xs', cellPx, requestCellMax)}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex min-w-0 cursor-default items-start gap-2">
                  <div className="flex-shrink-0 rounded-md bg-brand-blue/10 p-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-brand-blue" />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="truncate font-medium text-gray-900">{request.request_title}</div>
                    <div className="mt-0.5 line-clamp-2 truncate text-xs text-gray-500">
                      {request.description || t('approvals.table.noDescription', 'No description')}
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm">
                <div className="space-y-1">
                  <p className="font-medium">{request.request_title}</p>
                  <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                    {request.description || t('approvals.table.noDescription', 'No description')}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TableCell>
          <TableCell className={cn('text-xs', cellPx)}>
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-gray-100 p-1">
                <User className="h-3 w-3 text-gray-600" />
              </div>
              <span className="font-medium text-gray-700">{request.requester_name}</span>
            </div>
          </TableCell>
          <TableCell className={cn('text-xs text-gray-600', cellPx)}>
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-gray-100 p-1">
                <Building className="h-3 w-3 text-gray-600" />
              </div>
              <span>{request.department_name || t('approvals.table.notSpecified', 'Not specified')}</span>
            </div>
          </TableCell>
          <TableCell className={cn('text-xs', cellPx)}>
            <div className="font-bold text-gray-900">{formatToRupiah(request.amount_idr)}</div>
          </TableCell>
          <TableCell className={cn('text-xs', cellPx)}>
            <Badge variant="outline" className="text-xs">
              {getTypeDisplay(request)}
            </Badge>
          </TableCell>
          <TableCell className={cn('text-xs', cellPx)}>{getStatusBadge(request.status)}</TableCell>
          <TableCell className={cn('whitespace-nowrap text-xs', cellPx)}>
            <Badge variant={request.is_recurring ? 'default' : 'secondary'}>
              {request.is_recurring
                ? t('approvals.recurring.yes', 'Recurring')
                : t('approvals.recurring.no', 'One-time')}
            </Badge>
          </TableCell>
          <TableCell className={cn('text-xs text-gray-600', cellPx)}>
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-gray-100 p-1">
                <Calendar className="h-3 w-3 text-gray-600" />
              </div>
              <span>{format(new Date(request.created_at || request.submitted_at || ''), 'MMM dd, yyyy')}</span>
            </div>
          </TableCell>
          <TableCell className={cn('text-xs text-gray-600', cellPx)}>
            {request.approved_at ? (
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-gray-100 p-1">
                  <Calendar className="h-3 w-3 text-gray-600" />
                </div>
                <span>{format(new Date(request.approved_at), 'MMM dd, yyyy')}</span>
              </div>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </TableCell>
          <TableCell className={cn('text-xs text-gray-600', cellPx)}>
            {request.approved_by_name ? (
              <span className="font-medium">{request.approved_by_name}</span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </TableCell>
          <TableCell className={cn('text-xs', cellPx)}>
            <ApprovalActionsDropdown
              requestId={request.id}
              status={request.status || ''}
              triggerButtonClassName={isMobileCard ? triggerClassMobile : undefined}
            />
          </TableCell>
        </TableRow>
      ))
    );

  const tableBody = isLoading && isMobileCard ? skeletonRows : dataRows;

  const tableEl = (
    <table className="caption-bottom w-full min-w-[1300px] text-sm">
      <TableHeader
        className={cn(
          'sticky top-0 z-10',
          isMobileCard ? 'border-b border-white/20 bg-brand-blue' : 'bg-gray-50 shadow-sm',
        )}
      >
        {headerCells}
      </TableHeader>
      <TableBody>{tableBody}</TableBody>
    </table>
  );

  const scrollWrapClass = cn(
    'scrollbar-hide seamless-scroll min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
    isMobileCard
      ? fixedMobileViewport
        ? cn(
            'nested-scroll-touch-chain min-h-0 min-w-0 overflow-y-auto [touch-action:pan-x_pan-y]',
            'h-[min(28rem,calc(100dvh-14rem))] max-h-[28rem] min-h-[11rem] shrink-0',
            SCROLL_HIDE,
          )
        : cn(
            'nested-scroll-touch-chain min-h-0 min-w-0 overflow-y-auto [touch-action:pan-x_pan-y]',
            fillScrollHeight && 'flex-1',
            !fillScrollHeight && 'max-h-[50vh]',
            SCROLL_HIDE,
          )
      : 'min-h-0 flex-1',
  );

  if (isLoading && !isMobileCard) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-1/4 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-200" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isMobileCard) {
    return (
      <div
        className={cn(
          'min-w-0 w-full',
          fillScrollHeight && !fixedMobileViewport && 'flex min-h-0 min-w-0 flex-1 flex-col',
        )}
      >
        <div className={scrollWrapClass}>{tableEl}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2">
        <h2 className="text-sm font-semibold text-gray-900">
          {t('approvals.table.sectionTitle', 'Approval Requests')}
        </h2>
      </div>
      <div className={scrollWrapClass}>{tableEl}</div>
    </div>
  );
};
