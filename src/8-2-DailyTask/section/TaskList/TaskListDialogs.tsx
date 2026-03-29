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
} from '@/shared/components/ui/alert-dialog';
import { BlockerDetailsModal } from '@/8-2-DailyTaskReport/components/BlockerDetailsModal';
import { DeadlineExtensionDialog } from '../DeadlineExtensionDialog';
import { DeadlineHistoryDialog } from '../DeadlineHistoryDialog';
import { EditTaskDialog } from '../EditTaskDialog';
import { ModalAddTaskStep } from '../ModalAddTaskStep';
import { AddTemplateModal } from '../AddTemplateModal';
import type { Task } from '../../types';

export interface TaskListDialogsProps {
  tasks: Task[];
  deadlineDialog: { isOpen: boolean; taskId: string | null };
  setDeadlineDialog: (v: { isOpen: boolean; taskId: string | null }) => void;
  historyDialog: { isOpen: boolean; taskId: string | null };
  setHistoryDialog: (v: { isOpen: boolean; taskId: string | null }) => void;
  editingTask: string | null;
  setEditingTask: (v: string | null) => void;
  addStepDialog: { isOpen: boolean; taskId: string | null; taskTitle: string };
  setAddStepDialog: (v: { isOpen: boolean; taskId: string | null; taskTitle: string }) => void;
  addTemplateDialog: { isOpen: boolean; taskId: string | null; taskTitle: string };
  setAddTemplateDialog: (v: { isOpen: boolean; taskId: string | null; taskTitle: string }) => void;
  deleteDialog: { isOpen: boolean; taskId: string | null; taskTitle: string };
  handleCancelDelete: () => void;
  handleConfirmDelete: () => void;
  blockerModalOpen: boolean;
  setBlockerModalOpen: (v: boolean) => void;
  blockerModalItems: any[];
  requestDeadlineExtension: (taskId: string, newDeadline: string, reason: string) => Promise<void>;
}

export function TaskListDialogs({
  tasks,
  deadlineDialog,
  setDeadlineDialog,
  historyDialog,
  setHistoryDialog,
  editingTask,
  setEditingTask,
  addStepDialog,
  setAddStepDialog,
  addTemplateDialog,
  setAddTemplateDialog,
  deleteDialog,
  handleCancelDelete,
  handleConfirmDelete,
  blockerModalOpen,
  setBlockerModalOpen,
  blockerModalItems,
  requestDeadlineExtension,
}: TaskListDialogsProps) {
  return (
    <>
      <DeadlineExtensionDialog
        isOpen={deadlineDialog.isOpen}
        onClose={() => setDeadlineDialog({ isOpen: false, taskId: null })}
        taskId={deadlineDialog.taskId}
        currentDeadline={
          deadlineDialog.taskId
            ? tasks.find((t) => t.id === deadlineDialog.taskId)?.due_date || null
            : null
        }
        onRequestExtension={requestDeadlineExtension}
      />

      <DeadlineHistoryDialog
        isOpen={historyDialog.isOpen}
        onClose={() => setHistoryDialog({ isOpen: false, taskId: null })}
        taskId={historyDialog.taskId}
        deadlineHistory={
          historyDialog.taskId
            ? tasks.find((t) => t.id === historyDialog.taskId)?.deadline_history || []
            : []
        }
      />

      <EditTaskDialog
        isOpen={editingTask !== null}
        onClose={() => setEditingTask(null)}
        taskId={editingTask}
      />

      {addStepDialog.taskId && (
        <ModalAddTaskStep
          open={addStepDialog.isOpen}
          onOpenChange={(open) => setAddStepDialog({ isOpen: open, taskId: null, taskTitle: '' })}
          taskId={addStepDialog.taskId}
          taskTitle={addStepDialog.taskTitle}
          onSuccess={() => {}}
        />
      )}

      {addTemplateDialog.taskId && (
        <AddTemplateModal
          open={addTemplateDialog.isOpen}
          onOpenChange={(open) => !open && setAddTemplateDialog({ isOpen: false, taskId: null, taskTitle: '' })}
          taskId={addTemplateDialog.taskId}
          taskTitle={addTemplateDialog.taskTitle ?? ''}
        />
      )}

      <AlertDialog open={deleteDialog.isOpen} onOpenChange={handleCancelDelete}>
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
                {deleteDialog.taskTitle && (
                  <div className="font-semibold text-gray-900 bg-gray-50 p-2 rounded border border-gray-200 text-sm">
                    &quot;{deleteDialog.taskTitle}&quot;
                  </div>
                )}
                <div className="text-red-600 font-medium text-sm">
                  This action cannot be undone. This will permanently delete the task and all its
                  associated data including steps, files, and history.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BlockerDetailsModal
        open={blockerModalOpen}
        onOpenChange={setBlockerModalOpen}
        items={blockerModalItems}
        initialTab="list"
      />
    </>
  );
}
