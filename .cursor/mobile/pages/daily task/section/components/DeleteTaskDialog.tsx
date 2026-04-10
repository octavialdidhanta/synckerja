import React from 'react';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/features/ui/alert-dialog';

interface DeleteTaskDialogProps {
  isOpen: boolean;
  taskTitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteTaskDialog: React.FC<DeleteTaskDialogProps> = ({
  isOpen,
  taskTitle,
  onConfirm,
  onCancel,
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            Delete Task
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                Are you sure you want to delete this task?
              </div>
              {taskTitle && (
                <div className="font-semibold text-gray-900 bg-gray-50 p-2 rounded border border-gray-200 text-sm">
                  "{taskTitle}"
                </div>
              )}
              <div className="text-red-600 font-medium text-sm">
                This action cannot be undone. This will permanently delete the task and all its associated data including steps, files, and history.
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Task
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

