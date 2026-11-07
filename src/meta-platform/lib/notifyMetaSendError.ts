import { toast } from 'sonner';
import type { TFunction } from 'i18next';

/** Accepts i18next `t` or the app `useAppTranslation().t` (key, fallback). */
export type MetaNotifyTranslate = TFunction | ((key: string, fallback?: string) => string);

type MetaSendErrorPayload = {
  error?: string;
  code?: string;
  needs_reconnect?: boolean;
};

export function notifyMetaSendError(
  translate: MetaNotifyTranslate,
  json: MetaSendErrorPayload,
  connectPath: '/omnichannel/integrations/instagram' | '/omnichannel/integrations/facebook',
): void {
  const t = translate as (key: string, fallback?: string) => string;
  const msg = typeof json.error === 'string' ? json.error : t('metaPlatform.sendFailed', 'Failed to send message.');
  if (json.needs_reconnect || json.code === 'META_TOKEN_INVALID') {
    toast.error(msg, {
      description: t(
        'metaPlatform.reconnectFromIntegrations',
        'Open Integrations and reconnect your Facebook/Instagram account.',
      ),
      action: {
        label: t('metaPlatform.openConnect', 'Open Connect'),
        onClick: () => {
          window.location.href = connectPath;
        },
      },
      duration: 14000,
    });
    return;
  }
  toast.error(msg);
}
