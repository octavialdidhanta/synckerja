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
import { Button } from '@/shared/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: string;
  accountLabel: string;
  isPending?: boolean;
  /** TikTok: API cannot delete published videos — show clear-link copy + optional open URL. */
  platformNote?: string;
  publishedVideoUrl?: string | null;
  onConfirm: () => void;
};

export function DeletePublishedConfirmDialog({
  open,
  onOpenChange,
  platform,
  accountLabel,
  isPending = false,
  platformNote,
  publishedVideoUrl = null,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const isTikTok = platform === 'TikTok';
  const videoUrl = publishedVideoUrl?.trim() || null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isTikTok
              ? t(
                  'digitalMarketing.scheduledPosts.deleteFromPlatformTikTokConfirmTitle',
                  'Clear TikTok link in Synckerja?',
                )
              : t('digitalMarketing.scheduledPosts.deleteFromPlatformConfirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                {isTikTok
                  ? t(
                      'digitalMarketing.scheduledPosts.deleteFromPlatformTikTokConfirmBody',
                      'TikTok does not provide an API to delete published videos. Synckerja can only remove the link and schedule here. Delete the video manually in the TikTok app ({{account}}).',
                      { account: accountLabel },
                    )
                  : t('digitalMarketing.scheduledPosts.deleteFromPlatformConfirmBody', {
                      platform,
                      account: accountLabel,
                    })}
              </p>
              {platformNote ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                  {platformNote}
                </p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel disabled={isPending}>
            {t('common.cancel', 'Cancel')}
          </AlertDialogCancel>
          {isTikTok && videoUrl ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              className="gap-1.5"
              onClick={() => {
                window.open(videoUrl, '_blank', 'noopener,noreferrer');
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t(
                'digitalMarketing.scheduledPosts.deleteFromPlatformTikTokOpenVideo',
                'Open on TikTok',
              )}
            </Button>
          ) : null}
          <AlertDialogAction
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isTikTok
              ? t(
                  'digitalMarketing.scheduledPosts.deleteFromPlatformTikTokConfirmAction',
                  'Clear in Synckerja',
                )
              : t('digitalMarketing.scheduledPosts.deleteFromPlatform')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
