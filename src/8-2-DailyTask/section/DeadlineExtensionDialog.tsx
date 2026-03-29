import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';

interface DeadlineExtensionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string | null;
  currentDeadline: string | null;
  onRequestExtension: (taskId: string, newDeadline: string, reason: string) => Promise<void>;
}

export const DeadlineExtensionDialog: React.FC<DeadlineExtensionDialogProps> = ({
  isOpen,
  onClose,
  taskId,
  currentDeadline,
  onRequestExtension
}) => {
  const isMobile = useIsMobile();
  const [newDeadline, setNewDeadline] = useState<Date | undefined>();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prefill highlight date when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (currentDeadline) {
        const base = new Date(currentDeadline);
        base.setDate(base.getDate() + 1);
        setNewDeadline(base);
      } else {
        setNewDeadline(new Date());
      }
    } else {
      setNewDeadline(undefined);
      setReason('');
    }
  }, [isOpen, currentDeadline]);

  const handleSubmit = async () => {
    if (!taskId || !newDeadline || !reason.trim()) return;

    setIsSubmitting(true);
    try {
      await onRequestExtension(taskId, newDeadline.toISOString(), reason.trim());
      handleClose();
    } catch (error) {
      console.error('Error requesting deadline extension:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(value) => {
        if (!value) handleClose();
      }}
    >
      <DialogContent
        className={cn(
          'p-0 flex flex-col gap-0',
          isMobile
            ? 'fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area z-30'
            : 'w-[520px] max-w-[90vw] max-h-[85vh] h-[560px]'
        )}
        overlayClassName={isMobile ? 'z-30' : undefined}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
              <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold">Request Deadline Extension</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a new deadline and tell us why you need extra time.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div
          className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6"
          style={{
            scrollbarWidth: 'thin',
            scrollBehavior: 'smooth',
            scrollbarColor: '#d1d5db transparent',
          }}
        >
          {currentDeadline && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Deadline</Label>
              <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                <CalendarIcon className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="text-sm text-gray-800 dark:text-gray-200">
                  {format(new Date(currentDeadline), 'MMM dd, yyyy')}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="newDeadline" className="text-sm font-medium">
              New Deadline
            </Label>
            <Input
              id="newDeadline"
              type="date"
              value={newDeadline ? format(newDeadline, 'yyyy-MM-dd') : ''}
              onChange={(e) => {
                const v = e.target.value;
                setNewDeadline(v ? new Date(v + 'T12:00:00') : undefined);
              }}
              min={
                currentDeadline
                  ? (() => {
                      const d = new Date(currentDeadline);
                      d.setDate(d.getDate() + 1);
                      return format(d, 'yyyy-MM-dd');
                    })()
                  : undefined
              }
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Reason for Extension
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain why you need a deadline extension..."
              rows={4}
              className="resize-none text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={!newDeadline || !reason.trim() || isSubmitting}
              className="min-w-[120px] flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                'Request Extension'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
