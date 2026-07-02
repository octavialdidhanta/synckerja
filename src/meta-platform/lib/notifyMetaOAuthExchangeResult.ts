import type { TFunction } from 'i18next';
import { toast } from 'sonner';

export type MetaOAuthWarningCode = 'no_pages_found' | 'webhook_partial';

export type MetaOAuthExchangeNotifyPayload = {
  accounts_synced?: number;
  facebook_pages_synced?: number;
  webhook_subscribed_count?: number;
  warning?: string;
  warning_code?: MetaOAuthWarningCode | string;
};

export type NotifyMetaOAuthOptions = {
  /** Show inbox/webhook partial warning (off on content-only settings panels). */
  notifyWebhookPartial?: boolean;
};

function isLegacyWebhookWarning(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('webhook') || lower.includes('pages_manage_metadata');
}

function isWebhookPartial(payload: MetaOAuthExchangeNotifyPayload): boolean {
  if (payload.warning_code === 'webhook_partial') return true;
  if (payload.warning?.trim() && isLegacyWebhookWarning(payload.warning)) return true;
  const synced = (payload.accounts_synced ?? 0) + (payload.facebook_pages_synced ?? 0);
  const webhookSynced = payload.webhook_subscribed_count ?? 0;
  return synced > 0 && webhookSynced < synced;
}

export function notifyMetaOAuthExchangeWarnings(
  t: TFunction,
  payload: MetaOAuthExchangeNotifyPayload,
  options: NotifyMetaOAuthOptions = {},
): void {
  const notifyWebhookPartial = options.notifyWebhookPartial !== false;

  if (payload.warning_code === 'no_pages_found') {
    toast.warning(
      t(
        'metaOAuth.warning.noPagesFound',
        'Login succeeded but no Facebook Page was found. Make sure you have Page admin access, then try again.',
      ),
      { duration: 10000 },
    );
    return;
  }

  if (notifyWebhookPartial && isWebhookPartial(payload)) {
    toast.warning(
      t(
        'metaOAuth.warning.webhookPartial',
        'Account connected, but inbox notifications could not be fully enabled.',
      ),
      {
        description: t(
          'metaOAuth.warning.webhookPartialHint',
          'Disconnect and connect again with Facebook. If the issue continues, contact Synckerja support.',
        ),
        duration: 12000,
      },
    );
    return;
  }

  if (payload.warning?.trim() && !isLegacyWebhookWarning(payload.warning)) {
    toast.info(
      t(
        'metaOAuth.warning.generic',
        'Connected with a partial setup. Reconnect or contact support if features are missing.',
      ),
      { duration: 10000 },
    );
  }
}
