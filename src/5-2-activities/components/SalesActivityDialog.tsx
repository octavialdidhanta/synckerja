import React from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { cn } from '@/shared/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { SalesActivityForm } from './SalesActivityForm';

/** Scrollable body: keeps scroll behavior, hides visible scrollbar (cross-browser). */
const dialogBodyScrollClasses =
  'min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

interface SalesActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  activity?: any;
  /** Hanya lihat data; form tidak bisa disimpan dari dialog ini. */
  readOnly?: boolean;
  onRecordPaymentRequested?: (args: { activityId: string; clientName: string }) => void;
  onRecordPaymentFromHeader?: () => void;
}

export const SalesActivityDialog = ({
  open,
  onOpenChange,
  onSuccess,
  activity,
  readOnly = false,
  onRecordPaymentRequested,
  onRecordPaymentFromHeader,
}: SalesActivityDialogProps) => {
  const { t } = useAppTranslation();

  const handleSuccess = () => {
    onSuccess();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex h-[min(90vh,920px)] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0',
          'rounded-none border bg-background shadow-lg sm:rounded-none',
        )}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b px-6 pb-4 pt-12 text-left sm:pr-14">
          <div className="flex flex-wrap items-start justify-between gap-2 pr-8">
            <DialogTitle>
              {readOnly
                ? t('salesActivities.dialog.viewTitle', 'Sales activity details')
                : activity
                  ? t('salesActivities.dialog.editTitle', 'Edit Sales Activity')
                  : t('salesActivities.dialog.createTitle', 'Add New Sales Activity')}
            </DialogTitle>
            {activity && !readOnly && onRecordPaymentFromHeader ? (
              <Button type="button" size="sm" variant="outline" onClick={onRecordPaymentFromHeader}>
                {t('salesActivities.recordPayment', 'Record Payment')}
              </Button>
            ) : null}
          </div>
        </DialogHeader>
        <div className={cn(dialogBodyScrollClasses, 'px-6 py-4')}>
          <SalesActivityForm
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            activity={activity}
            readOnly={readOnly}
            onRecordPaymentRequested={onRecordPaymentRequested}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
