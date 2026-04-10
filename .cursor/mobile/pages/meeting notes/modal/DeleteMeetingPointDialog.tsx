import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/features/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/features/ui/dialog';
import { useToast } from '@/features/1-login/hooks/use-toast';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface MeetingPoint {
  id: string;
  discussion_point: string;
}

interface DeleteMeetingPointDialogProps {
  isOpen: boolean;
  onClose: () => void;
  meetingPoint: MeetingPoint | null;
  onDeleteSuccess: (id: string) => Promise<void>;
}

const DeleteMeetingPointDialog = ({
  isOpen,
  onClose,
  meetingPoint,
  onDeleteSuccess,
}: DeleteMeetingPointDialogProps) => {
  const isMobile = useIsMobile();
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!meetingPoint?.id) return;

    setIsDeleting(true);
    try {
      await onDeleteSuccess(meetingPoint.id);
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete meeting point', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'w-full max-w-none m-0 rounded-none translate-x-0 translate-y-0 flex flex-col p-0 gap-0 border-none bg-card shadow-xl focus:outline-none overflow-hidden',
          isMobile
            ? 'fixed left-0 right-0 top-0 modal-above-safe-area h-screen'
            : 'md:max-w-md md:rounded-lg md:translate-x-[-50%] md:translate-y-[-50%] md:left-[50%] md:top-[50%] fixed inset-0 md:h-auto md:max-h-[90vh]'
        )}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <DialogHeader
          className={cn(
            'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left',
            isMobile ? 'safe-area-top px-4 pt-4 pb-3' : 'md:px-6 md:pt-6 md:pb-4'
          )}
        >
          <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-red-600 dark:text-red-500">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden />
            Delete Meeting Point
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-4 pt-4 pb-4 md:px-6">
          <DialogDescription className="text-muted-foreground text-sm text-left">
            Are you sure you want to delete this meeting point? This action cannot be undone.
            {meetingPoint && (
              <div className="mt-2 p-2 bg-muted rounded text-sm break-words">
                <strong>Discussion Point:</strong> {meetingPoint.discussion_point}
              </div>
            )}
          </DialogDescription>
        </div>

        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isDeleting}
              onClick={handleDelete}
              className="min-w-[120px] flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteMeetingPointDialog;
