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
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: string;
  accountLabel: string;
  isPending?: boolean;
  onConfirm: () => void;
};

export function DeletePublishedConfirmDialog({
  open,
  onOpenChange,
  platform,
  accountLabel,
  isPending = false,
  onConfirm,
}: Props) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('digitalMarketing.scheduledPosts.deleteFromPlatformConfirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('digitalMarketing.scheduledPosts.deleteFromPlatformConfirmBody', {
              platform,
              account: accountLabel,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t('common.cancel', 'Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('digitalMarketing.scheduledPosts.deleteFromPlatform')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
