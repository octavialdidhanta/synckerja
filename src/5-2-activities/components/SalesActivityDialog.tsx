import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { cn } from '@/shared/lib/utils';
import { SalesActivityForm } from './SalesActivityForm';

/** Scrollable body: keeps scroll behavior, hides visible scrollbar (cross-browser). */
const dialogBodyScrollClasses =
  'min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

interface SalesActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  activity?: any;
}

export const SalesActivityDialog = ({ open, onOpenChange, onSuccess, activity }: SalesActivityDialogProps) => {
  const handleSuccess = () => {
    onSuccess();
    // Close dialog after successful creation
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
          <DialogTitle className="pr-8">
            {activity ? 'Edit Sales Activity' : 'Add New Sales Activity'}
          </DialogTitle>
        </DialogHeader>
        <div className={cn(dialogBodyScrollClasses, 'px-6 py-4')}>
          <SalesActivityForm
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            activity={activity}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
