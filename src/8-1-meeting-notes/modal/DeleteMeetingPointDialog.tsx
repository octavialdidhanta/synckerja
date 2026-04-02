
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
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
  onDeleteSuccess 
}: DeleteMeetingPointDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!meetingPoint?.id) return;

    setIsDeleting(true);
    
    try {
      await onDeleteSuccess(meetingPoint.id);
      onClose();
    } catch {
      // Context shows toast; close modal so user can retry from list if needed
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="bg-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Delete Meeting Point
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-600">
            Are you sure you want to delete this meeting point? This action cannot be undone.
          </AlertDialogDescription>
          {meetingPoint && (
            <div className="mt-2 rounded bg-gray-50 p-2 text-sm text-gray-700">
              <span className="font-semibold">Discussion Point:</span>{" "}
              <span className="text-gray-700">{meetingPoint.discussion_point}</span>
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteMeetingPointDialog;
