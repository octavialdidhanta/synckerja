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
import { Clock, MapPin, MoreVertical, Eye, Edit, Trash } from 'lucide-react';
import { ClientVisitsTableFooter } from './ClientVisitsTableFooter';
import { ClientVisitPhotoThumbnail } from './ClientVisitPhotoThumbnail';
import { ClientVisitDetailDialog, type ClientVisitRow } from './ClientVisitDetailDialog';
import { ClientVisitEditDialog, type ClientVisitEditPayload } from './ClientVisitEditDialog';
import { ClientVisitTimelinessBadge } from './ClientVisitTimelinessBadge';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { formatClientVisitTimeRange } from '../utils/clientVisitTimeDisplay';

interface ClientVisitsTableProps {
  visits: ClientVisitRow[];
  selectedStatus?: string;
  onUpdateVisit?: (visitId: string, payload: ClientVisitEditPayload) => Promise<void>;
  onCancelVisit?: (visitId: string) => Promise<void>;
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
}: {
  visit: ClientVisitRow;
  onUpdateVisit?: (visitId: string, payload: ClientVisitEditPayload) => Promise<void>;
  onCancelVisit?: (visitId: string) => Promise<void>;
}) => {
  const { t } = useAppTranslation();
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
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

  return (
    <>
      <TableRow className="hover:bg-gray-50/50 h-12 transition-colors">
        <TableCell className="min-w-[160px] px-3 text-sm">
          <div>
            <span
              className="truncate block font-medium text-gray-900"
              title={visit.clientInfo?.company_name || 'Unknown Client'}
            >
              {visit.clientInfo?.company_name || 'Unknown Client'}
            </span>
            {visit.clientInfo?.contact_phone && (
              <span
                className="text-xs text-gray-500 truncate block"
                title={visit.clientInfo.contact_phone}
              >
                {visit.clientInfo.contact_phone}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="min-w-[144px] px-3 text-sm">
          <div>
            <span
              className="truncate block font-medium text-gray-900"
              title={visit.employees?.full_name || 'Unknown Employee'}
            >
              {visit.employees?.full_name || 'Unknown Employee'}
            </span>
            {visit.employees?.email && (
              <span className="text-xs text-gray-500 truncate block" title={visit.employees.email}>
                {visit.employees.email}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="min-w-[112px] px-3 text-sm whitespace-nowrap">
          {formatDate(visit.visit_date)}
        </TableCell>
        <TableCell className="min-w-[160px] px-3 text-sm">
          <div>
            <div className="flex items-center text-xs text-gray-600 mb-1">
              <Clock className="h-3 w-3 mr-1 flex-shrink-0 text-brand-blue" />
              <span>
                {t('clientVisits.time.plan', 'Plan')}:{' '}
                {formatClientVisitTimeRange(visit.planned_start_time, visit.planned_end_time)}
              </span>
            </div>
            {(visit.actual_start_time || visit.actual_end_time) && (
              <div className="flex items-center text-xs text-green-600">
                <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                <span>
                  {t('clientVisits.time.actual', 'Actual')}:{' '}
                  {formatClientVisitTimeRange(visit.actual_start_time, visit.actual_end_time)}
                </span>
              </div>
            )}
          </div>
        </TableCell>
        <TableCell className="min-w-[128px] px-3">
          <ClientVisitTimelinessBadge visit={visit} />
        </TableCell>
        <TableCell className="min-w-[192px] px-3 text-sm">
          <div>
            <span className="truncate block" title={visit.visit_purpose || '-'}>
              {visit.visit_purpose || '-'}
            </span>
            {visit.notes && (
              <span className="text-xs text-gray-500 truncate block" title={visit.notes}>
                {visit.notes}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="min-w-[112px] px-3">
          <Badge className={`${getStatusColor(visit.status || '')} text-xs px-2 py-1 border`}>
            {visit.status?.charAt(0).toUpperCase() + visit.status?.slice(1) || 'Unknown'}
          </Badge>
        </TableCell>
        <TableCell className="min-w-[160px] px-3 text-sm">
          <div>
            <div className="flex items-center">
              <MapPin className="h-3 w-3 mr-1 flex-shrink-0 text-gray-400" />
              <span className="truncate block" title={visit.locationInfo?.name || 'Location not set'}>
                {visit.locationInfo?.name || 'Location not set'}
              </span>
            </div>
            {visit.locationInfo?.address && (
              <span className="text-xs text-gray-500 truncate block" title={visit.locationInfo.address}>
                {visit.locationInfo.address}
              </span>
            )}
            {visit.validation_accuracy_meters != null && (
              <span className="text-xs text-green-600 truncate block">
                ✓ Verified ({visit.validation_accuracy_meters}m)
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="min-w-[72px] px-3">
          <ClientVisitPhotoThumbnail
            photoPath={visit.start_photo_path}
            employeeId={visit.employee_id}
            label={t('clientVisits.startPhoto', 'Start visit photo')}
          />
        </TableCell>
        <TableCell className="min-w-[72px] px-3">
          <ClientVisitPhotoThumbnail
            photoPath={visit.end_photo_path}
            employeeId={visit.employee_id}
            label={t('clientVisits.endPhoto', 'End visit photo')}
          />
        </TableCell>
        <TableCell className="min-w-[96px] px-3">
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
              <DropdownMenuItem
                className="text-xs"
                disabled={!isScheduled}
                onClick={handleEdit}
              >
                <Edit className="h-3 w-3 mr-2" />
                {t('clientVisits.actions.editVisit', 'Edit Visit')}
              </DropdownMenuItem>
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
    </>
  );
});

VisitRow.displayName = 'VisitRow';

export const ClientVisitsTable = memo(({
  visits,
  selectedStatus = 'all',
  onUpdateVisit,
  onCancelVisit,
}: ClientVisitsTableProps) => {
  const { t } = useAppTranslation();

  const tableHeaders = useMemo(
    () => [
      { key: 'client', label: t('clientVisits.table.client', 'Client'), width: 'min-w-[160px]' },
      { key: 'employee', label: t('clientVisits.table.employee', 'Employee'), width: 'min-w-[144px]' },
      { key: 'date', label: t('clientVisits.table.date', 'Date'), width: 'min-w-[112px]' },
      { key: 'time', label: t('clientVisits.table.time', 'Time'), width: 'min-w-[160px]' },
      { key: 'timeStatus', label: t('clientVisits.table.timeStatus', 'Time status'), width: 'min-w-[128px]' },
      { key: 'purpose', label: t('clientVisits.table.purpose', 'Purpose'), width: 'min-w-[192px]' },
      { key: 'status', label: t('clientVisits.table.status', 'Status'), width: 'min-w-[112px]' },
      { key: 'location', label: t('clientVisits.table.location', 'Location'), width: 'min-w-[160px]' },
      { key: 'startPhoto', label: t('clientVisits.startPhoto', 'Start photo'), width: 'min-w-[72px]' },
      { key: 'endPhoto', label: t('clientVisits.endPhoto', 'End photo'), width: 'min-w-[72px]' },
      { key: 'actions', label: t('clientVisits.table.actions', 'Actions'), width: 'min-w-[96px]' },
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
        />
      )),
    [visits, onUpdateVisit, onCancelVisit],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[1520px] caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-20 bg-gray-50 shadow-sm">
            <TableRow className="hover:bg-transparent">
              {tableHeaders.map((header) => (
                <TableHead
                  key={header.key}
                  className={`text-xs font-medium text-gray-700 ${header.width} min-w-0 px-3 bg-gray-50 whitespace-nowrap`}
                >
                  {header.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-gray-500 text-sm">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="text-lg">👥</div>
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

      <ClientVisitsTableFooter
        totalVisits={visits.length}
        completedVisits={visits.filter((v) => v.status === 'completed').length}
        filteredVisits={visits.length}
        selectedStatus={selectedStatus}
      />
    </div>
  );
});

ClientVisitsTable.displayName = 'ClientVisitsTable';
