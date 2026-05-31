import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { ClientVisitRow } from './ClientVisitDetailDialog';

export interface ClientVisitEditPayload {
  visit_date: string;
  planned_start_time: string | null;
  planned_end_time: string | null;
  visit_purpose: string;
  notes: string | null;
}

interface ClientVisitEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visit: ClientVisitRow | null;
  saving?: boolean;
  onSave: (visitId: string, payload: ClientVisitEditPayload) => Promise<void>;
}

function toTimeInput(value?: string | null): string {
  if (!value?.trim()) return '';
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}/.test(trimmed)) return trimmed.slice(0, 5);
  try {
    return new Date(trimmed).toISOString().slice(11, 16);
  } catch {
    return '';
  }
}

export function ClientVisitEditDialog({
  open,
  onOpenChange,
  visit,
  saving = false,
  onSave,
}: ClientVisitEditDialogProps) {
  const { t } = useAppTranslation();
  const [visitDate, setVisitDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !visit) return;
    setVisitDate(visit.visit_date?.slice(0, 10) || '');
    setStartTime(toTimeInput(visit.planned_start_time));
    setEndTime(toTimeInput(visit.planned_end_time));
    setPurpose(visit.visit_purpose || '');
    setNotes(visit.notes || '');
  }, [open, visit]);

  if (!visit) return null;

  const handleSubmit = async () => {
    if (!purpose.trim() || !visitDate) return;
    await onSave(visit.id, {
      visit_date: visitDate,
      planned_start_time: startTime ? `${startTime}:00` : null,
      planned_end_time: endTime ? `${endTime}:00` : null,
      visit_purpose: purpose.trim(),
      notes: notes.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('clientVisits.edit.title', 'Edit Visit')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="visit-date">{t('clientVisits.table.date', 'Date')}</Label>
            <Input
              id="visit-date"
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start-time">{t('clientVisit.startTime', 'Start Time')}</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">{t('clientVisit.endTime', 'End Time')}</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="purpose">{t('clientVisits.table.purpose', 'Purpose')}</Label>
            <Input
              id="purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">{t('clientVisit.notes', 'Notes')}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving || !purpose.trim() || !visitDate}>
            {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
