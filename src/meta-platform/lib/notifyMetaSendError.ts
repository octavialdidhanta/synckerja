import { toast } from 'sonner';
import type { TFunction } from 'i18next';

type MetaSendErrorPayload = {
  error?: string;
  code?: string;
  needs_reconnect?: boolean;
};

export function notifyMetaSendError(
  t: TFunction,
  json: MetaSendErrorPayload,
  connectPath: '/omnichannel/integrations/instagram' | '/omnichannel/integrations/facebook',
): void {
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
