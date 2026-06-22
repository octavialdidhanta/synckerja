import React, { memo, useMemo, useCallback, useState } from 'react';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Clock, MapPin, User, MoreVertical, Eye, Edit, DollarSign, Trash } from 'lucide-react';
import { VisitSchedulingTableFooter } from './VisitSchedulingTableFooter';
import { PaymentUpdateModal } from './PaymentUpdateModal';
import {
  ClientVisitDetailDialog,
  type ClientVisitRow,
} from '@/5-2-client_visits/components/ClientVisitDetailDialog';
import {
  ClientVisitEditDialog,
  type ClientVisitEditPayload,
} from '@/5-2-client_visits/components/ClientVisitEditDialog';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface VisitSchedulingTableProps {
  visits: ClientVisitRow[];
  onUpdateVisit?: (visitId: string, payload: ClientVisitEditPayload) => Promise<void>;
  onCancelVisit?: (visitId: string) => Promise<void>;
  onUpdatePayment?: (visit: ClientVisitRow) => void;
  selectedStatus?: string;
  showPaymentActions?: boolean;
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'scheduled':
      return 'bg-brand-blue-soft text-brand-blue-deep border-brand-blue/25';
    case 'ongoing':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
};

const VisitRow = memo(({
  visit,
  onUpdateVisit,
  onCancelVisit,
  onUpdatePayment,
  showPaymentActions = false,
}: {
  visit: ClientVisitRow & { sales_activity_id?: string | null };
  onUpdateVisit?: (visitId: string, payload: ClientVisitEditPayload) => Promise<void>;
  onCancelVisit?: (visitId: string) => Promise<void>;
  onUpdatePayment?: (visit: ClientVisitRow) => void;
  showPaymentActions?: boolean;
}) => {
  const { t } = useAppTranslation();
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const isScheduled = visit.status === 'scheduled';
  const canCancel = isScheduled;

  const handleViewDetails = useCallback(() => {
    setDetailOpen(true);
  }, []);

  const handleEdit = useCallback(() => {
    if (!isScheduled) return;
    setEditOpen(true);
  }, [isScheduled]);

  const handleCancelClick = useCallback(() => {
    if (!canCancel) return;
    setCancelOpen(true);
  }, [canCancel]);

  const handleUpdatePayment = useCallback(() => {
    setIsPaymentModalOpen(true);
    onUpdatePayment?.(visit);
  }, [onUpdatePayment, visit]);

  const handleSaveEdit = useCallback(
    async (visitId: string, payload: ClientVisitEditPayload) => {
      if (!onUpdateVisit) return;
      setSaving(true);
      try {
        await onUpdateVisit(visitId, payload);
      } finally {
        setSaving(false);
      }
    },
    [onUpdateVisit],
  );

  const handleConfirmCancel = useCallback(async () => {
    if (!onCancelVisit || !canCancel) return;
    setCancelling(true);
    try {
      await onCancelVisit(visit.id);
      setCancelOpen(false);
    } finally {
      setCancelling(false);
    }
  }, [onCancelVisit, canCancel, visit.id]);

  const statusLabel = visit.status
    ? visit.status.charAt(0).toUpperCase() + visit.status.slice(1)
    : 'Unknown';

  return (
    <>
      <TableRow className="hover:bg-gray-50/50 h-12 transition-colors">
        <TableCell className="w-40 px-3 text-sm">
          <span
            className="truncate block font-medium text-gray-900"
            title={visit.clientInfo?.company_name || 'Unknown Client'}
          >
            {visit.clientInfo?.company_name || 'Unknown Client'}
          </span>
        </TableCell>
        <TableCell className="w-36 px-3 text-sm">
          <div className="flex items-center">
            <User className="h-3 w-3 mr-1 flex-shrink-0 text-gray-400" />
            <span className="truncate block" title={visit.employees?.full_name || 'Unassigned'}>
              {visit.employees?.full_name || 'Unassigned'}
            </span>
          </div>
        </TableCell>
        <TableCell className="w-32 px-3 text-sm whitespace-nowrap">
          {formatDate(visit.visit_date)}
        </TableCell>
        <TableCell className="w-32 px-3 text-sm whitespace-nowrap">
          <div className="flex items-center">
            <Clock className="h-3 w-3 mr-1 flex-shrink-0 text-gray-400" />
            <span>{visit.planned_start_time?.slice(0, 5) || 'TBD'}</span>
          </div>
        </TableCell>
        <TableCell className="w-48 px-3 text-sm">
          <span className="truncate block" title={visit.visit_purpose || '-'}>
            {visit.visit_purpose || '-'}
          </span>
        </TableCell>
        <TableCell className="w-32 px-3">
          <Badge className={`${getStatusColor(visit.status || '')} text-xs px-2 py-1 border`}>
            {statusLabel}
          </Badge>
        </TableCell>
        <TableCell className="w-40 px-3 text-sm">
          <div className="flex items-center">
            <MapPin className="h-3 w-3 mr-1 flex-shrink-0 text-gray-400" />
            <span className="truncate block" title={visit.locationInfo?.name || 'Location not set'}>
              {visit.locationInfo?.name || 'Location not set'}
            </span>
          </div>
        </TableCell>
        <TableCell className="w-24 px-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="text-xs" onClick={handleViewDetails}>
                <Eye className="h-3 w-3 mr-2" />
                {t('clientVisits.actions.viewDetails', 'View Details')}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" disabled={!isScheduled} onClick={handleEdit}>
                <Edit className="h-3 w-3 mr-2" />
                {t('clientVisits.actions.editVisit', 'Edit Visit')}
              </DropdownMenuItem>
              {showPaymentActions && visit?.sales_activity_id ? (
                <DropdownMenuItem className="text-xs" onClick={handleUpdatePayment}>
                  <DollarSign className="h-3 w-3 mr-2" />
                  Update Payment
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                className="text-xs text-red-600"
                disabled={!canCancel}
                onClick={handleCancelClick}
              >
                <Trash className="h-3 w-3 mr-2" />
                {t('clientVisits.actions.cancelVisit', 'Cancel Visit')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      <ClientVisitDetailDialog open={detailOpen} onOpenChange={setDetailOpen} visit={visit} />

      <ClientVisitEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        visit={visit}
        saving={saving}
        onSave={handleSaveEdit}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('clientVisits.cancel.title', 'Cancel this visit?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'clientVisits.cancel.description',
                'The visit will be marked as cancelled. This action cannot be undone.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmCancel();
              }}
            >
              {cancelling
                ? t('clientVisits.cancel.inProgress', 'Cancelling…')
                : t('clientVisits.actions.cancelVisit', 'Cancel Visit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PaymentUpdateModal
        open={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        salesActivityId={visit?.sales_activity_id || visit?.id}
        clientName={visit?.clientInfo?.company_name}
      />
    </>
  );
});

VisitRow.displayName = 'VisitRow';

export const VisitSchedulingTable = memo(({
  visits,
  onUpdateVisit,
  onCancelVisit,
  onUpdatePayment,
  selectedStatus = 'all',
  showPaymentActions = false,
}: VisitSchedulingTableProps) => {
  const { t } = useAppTranslation();

  const tableHeaders = useMemo(
    () => [
      { key: 'client', label: t('clientVisits.table.client', 'Client'), width: 'w-40' },
      { key: 'salesPerson', label: t('clientVisits.table.employee', 'Employee'), width: 'w-36' },
      { key: 'date', label: t('clientVisits.table.date', 'Date'), width: 'w-32' },
      { key: 'time', label: t('clientVisits.table.time', 'Time'), width: 'w-32' },
      { key: 'purpose', label: t('clientVisits.table.purpose', 'Purpose'), width: 'w-48' },
      { key: 'status', label: t('clientVisits.table.status', 'Status'), width: 'w-32' },
      { key: 'location', label: t('clientVisits.table.location', 'Location'), width: 'w-40' },
      { key: 'actions', label: t('clientVisits.table.actions', 'Actions'), width: 'w-24' },
    ],
    [t],
  );

  const renderVisitRows = useMemo(
    () =>
      visits.map((visit) => (
        <VisitRow
          key={visit.id}
          visit={visit}
          onUpdateVisit={onUpdateVisit}
          onCancelVisit={onCancelVisit}
          onUpdatePayment={onUpdatePayment}
          showPaymentActions={showPaymentActions}
        />
      )),
    [visits, onUpdateVisit, onCancelVisit, onUpdatePayment, showPaymentActions],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[1100px] caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-20 bg-gray-50 shadow-sm">
            <TableRow className="hover:bg-transparent">
              {tableHeaders.map((header) => (
                <TableHead
                  key={header.key}
                  className={`text-xs font-medium text-gray-700 ${header.width} px-3 bg-gray-50 whitespace-nowrap`}
                >
                  {header.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500 text-sm">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="text-lg">📅</div>
                    <div>{t('clientVisits.empty.title', 'No visits found')}</div>
                    <div className="text-xs text-gray-400">
                      {t('clientVisits.empty.hint', 'Try adjusting your filters or search terms')}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              renderVisitRows
            )}
          </TableBody>
        </table>
      </div>

      <VisitSchedulingTableFooter
        totalVisits={visits.length}
        scheduledVisits={visits.filter((v) => v.status === 'scheduled').length}
        filteredVisits={visits.length}
        selectedStatus={selectedStatus}
      />
    </div>
  );
});

VisitSchedulingTable.displayName = 'VisitSchedulingTable';
