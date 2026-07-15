import { AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';

type MetaReconnectBannerProps = {
  onReconnect: () => void;
  reconnecting?: boolean;
  className?: string;
  /** instagram_dm vs messenger_dm copy variant */
  variant?: 'instagram' | 'facebook';
};

export function MetaReconnectBanner({
  onReconnect,
  reconnecting,
  className,
  variant = 'instagram',
}: MetaReconnectBannerProps) {
  const { t } = useAppTranslation();
  const title =
    variant === 'facebook'
      ? t(
          'metaPlatform.reconnectBanner.messengerTitle',
          'Reconnect Facebook untuk mengaktifkan Messenger Live',
        )
      : t(
          'metaPlatform.reconnectBanner.instagramTitle',
          'Reconnect Facebook untuk mengaktifkan Instagram DM Live',
        );
  const description =
    variant === 'facebook'
      ? t(
          'metaPlatform.reconnectBanner.messengerHint',
          'Permission Live sudah disetujui Meta. Reconnect sekali agar token dan webhook Messenger terbaru.',
        )
      : t(
          'metaPlatform.reconnectBanner.instagramHint',
          'Permission Live sudah disetujui Meta. Reconnect sekali agar token dan webhook Instagram DM terbaru.',
        );

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-900">{title}</p>
          <p className="mt-0.5 text-xs text-amber-800/90">{description}</p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
        disabled={reconnecting}
        onClick={onReconnect}
      >
        {reconnecting
          ? t('metaPlatform.reconnectBanner.connecting', 'Reconnecting…')
          : t('metaPlatform.reconnectBanner.action', 'Reconnect with full permissions')}
      </Button>
    </div>
  );
}
