import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { ClientVisitPhotoThumbnail } from './ClientVisitPhotoThumbnail';
import { ClientVisitTimelinessBadge } from './ClientVisitTimelinessBadge';
import { format } from 'date-fns';
import {
  formatClientVisitTimeRange,
  getClientVisitTimeliness,
} from '../utils/clientVisitTimeDisplay';

export interface ClientVisitRow {
  id: string;
  employee_id?: string | null;
  visit_date: string;
  planned_start_time?: string | null;
  planned_end_time?: string | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  visit_purpose?: string | null;
  status?: string | null;
  notes?: string | null;
  start_photo_path?: string | null;
  end_photo_path?: string | null;
  validation_accuracy_meters?: number | null;
  clientInfo?: { company_name?: string; contact_phone?: string; contact_person?: string } | null;
  employees?: { full_name?: string; email?: string } | null;
  locationInfo?: { name?: string; address?: string } | null;
}

interface ClientVisitDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visit: ClientVisitRow | null;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch {
    return value;
  }
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-foreground">{value}</span>
    </div>
  );
}

export function ClientVisitDetailDialog({
  open,
  onOpenChange,
  visit,
}: ClientVisitDetailDialogProps) {
  const { t } = useAppTranslation();
  if (!visit) return null;

  const statusLabel = visit.status
    ? visit.status.charAt(0).toUpperCase() + visit.status.slice(1)
    : '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('clientVisits.detail.title', 'Visit Details')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <DetailRow
            label={t('clientVisits.table.client', 'Client')}
            value={visit.clientInfo?.company_name || '—'}
          />
          <DetailRow
            label={t('clientVisits.table.employee', 'Employee')}
            value={visit.employees?.full_name || '—'}
          />
          <DetailRow
            label={t('clientVisits.table.date', 'Date')}
            value={formatDate(visit.visit_date)}
          />
          <DetailRow
            label={t('clientVisits.table.time', 'Time')}
            value={formatClientVisitTimeRange(visit.planned_start_time, visit.planned_end_time)}
          />
          {(visit.actual_start_time || visit.actual_end_time) && (
            <DetailRow
              label={t('clientVisits.detail.actualTime', 'Actual time')}
              value={formatClientVisitTimeRange(visit.actual_start_time, visit.actual_end_time)}
            />
          )}
          {getClientVisitTimeliness(visit).kind !== 'pending' && (
            <DetailRow
              label={t('clientVisits.table.timeStatus', 'Time status')}
              value={<ClientVisitTimelinessBadge visit={visit} />}
            />
          )}
          <DetailRow
            label={t('clientVisits.table.purpose', 'Purpose')}
            value={visit.visit_purpose || '—'}
          />
          <DetailRow
            label={t('clientVisits.table.status', 'Status')}
            value={<Badge variant="outline">{statusLabel}</Badge>}
          />
          <DetailRow
            label={t('clientVisits.table.location', 'Location')}
            value={
              visit.locationInfo?.name
                ? `${visit.locationInfo.name}${visit.locationInfo.address ? ` — ${visit.locationInfo.address}` : ''}`
                : '—'
            }
          />
          {visit.notes ? (
            <DetailRow label={t('clientVisit.notes', 'Notes')} value={visit.notes} />
          ) : null}
          {visit.validation_accuracy_meters != null ? (
            <DetailRow
              label={t('clientVisits.detail.verification', 'Verification')}
              value={`${visit.validation_accuracy_meters}m`}
            />
          ) : null}

          <div className="border-t pt-3">
            <p className="mb-2 text-sm font-medium text-foreground">
              {t('clientVisits.detail.photos', 'Visit photos')}
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {t('clientVisits.startPhoto', 'Start photo')}
                </p>
                <ClientVisitPhotoThumbnail
                  photoPath={visit.start_photo_path}
                  employeeId={visit.employee_id}
                  label={t('clientVisits.startPhoto', 'Start photo')}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {t('clientVisits.endPhoto', 'End photo')}
                </p>
                <ClientVisitPhotoThumbnail
                  photoPath={visit.end_photo_path}
                  employeeId={visit.employee_id}
                  label={t('clientVisits.endPhoto', 'End photo')}
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
