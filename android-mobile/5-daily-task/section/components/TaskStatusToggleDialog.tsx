import React from 'react';
import { CheckSquare } from 'lucide-react';
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
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface TaskStatusToggleDialogProps {
  isOpen: boolean;
  taskTitle: string;
  nextStatus: 'completed' | 'pending';
  onConfirm: () => void;
  onCancel: () => void;
}

export function TaskStatusToggleDialog({
  isOpen,
  taskTitle,
  nextStatus,
  onConfirm,
  onCancel,
}: TaskStatusToggleDialogProps) {
  const { t } = useAppTranslation();
  const isCompleting = nextStatus === 'completed';

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckSquare className={`h-5 w-5 ${isCompleting ? 'text-green-600' : 'text-amber-600'}`} />
            {isCompleting
              ? t('dailyTask.confirmCompleteTaskTitle', 'Konfirmasi Menyelesaikan Tugas')
              : t('dailyTask.confirmReopenTaskTitle', 'Konfirmasi Membuka Kembali Tugas')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                {isCompleting
                  ? t(
                      'dailyTask.confirmCompleteTaskDesc',
                      'Apakah Anda yakin ingin menandai tugas ini sebagai selesai?',
                    )
                  : t(
                      'dailyTask.confirmReopenTaskDesc',
                      'Apakah Anda yakin ingin membuka kembali tugas ini?',
                    )}
              </div>
              {taskTitle ? (
                <div className="rounded border border-gray-200 bg-gray-50 p-2 text-sm font-semibold text-gray-900">
                  &quot;{taskTitle}&quot;
                </div>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t('common.cancel', 'Batal')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={isCompleting ? 'bg-green-600 hover:bg-green-700 focus:ring-green-600' : undefined}
          >
            {isCompleting
              ? t('dailyTask.confirmCompleteAction', 'Ya, Selesaikan')
              : t('dailyTask.confirmReopenAction', 'Ya, Buka Kembali')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
