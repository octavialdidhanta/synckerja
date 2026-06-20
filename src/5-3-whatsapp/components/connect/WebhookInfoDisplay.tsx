import React from 'react';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { useWhatsAppConfig } from '../../hooks/useWhatsAppConfig';
import { useInstagramAccounts } from '../../hooks/useInstagramAccounts';
import { useFacebookPages } from '../../hooks/useFacebookPages';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { SUPABASE_URL } from '@/shared/lib/supabaseClient';
import { Link2, Key, Info } from 'lucide-react';

const WHATSAPP_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
const INSTAGRAM_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/instagram-webhook`;

interface WebhookInfoDisplayProps {
  /** When true, no top border (e.g. when inside a single Card with other sections) */
  embedded?: boolean;
  /** 'whatsapp' | 'instagram' | 'facebook' (Messenger uses instagram-webhook URL). */
  variant?: 'whatsapp' | 'instagram' | 'facebook';
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export function WebhookInfoDisplay({ embedded, variant = 'whatsapp' }: WebhookInfoDisplayProps) {
  const { config, ensureInstagramVerifyToken } = useWhatsAppConfig();
  const { accounts: igAccounts } = useInstagramAccounts();
  const { pages: fbPages } = useFacebookPages();
  const { t } = useAppTranslation();
  const hasEnsuredIgToken = React.useRef(false);

  const isInstagram = variant === 'instagram';
  const isFacebook = variant === 'facebook';
  const isMetaWebhook = isInstagram || isFacebook;
  const webhookUrl = isMetaWebhook ? INSTAGRAM_WEBHOOK_URL : WHATSAPP_WEBHOOK_URL;
  const verifyToken = isFacebook
    ? (fbPages?.[0]?.verify_token?.trim() || null)
    : isInstagram
      ? (igAccounts?.[0]?.verify_token ?? config?.instagram_verify_token ?? null)
      : (config?.verify_token ?? null);
  const verifyTokenPlaceholder = isFacebook
    ? (fbPages?.length ? null : t('facebookConnect.verifyTokenPlaceholder', '— Connect a Facebook Page to see Verify Token —'))
    : isInstagram
      ? (igAccounts?.length || config?.instagram_verify_token ? null : t('instagramConnect.verifyTokenPlaceholder', '— Connect an Instagram account, or set up Connect WhatsApp, to see Verify Token —'))
      : '— Save config first to see Verify Token —';

  React.useEffect(() => {
    if (!isInstagram || embedded || hasEnsuredIgToken.current || verifyToken) return;
    if ((config?.instagram_verify_token ?? '').trim() !== '') return;
    if (!config?.id) return;
    hasEnsuredIgToken.current = true;
    ensureInstagramVerifyToken().catch(() => {
      hasEnsuredIgToken.current = false;
    });
  }, [isInstagram, config, verifyToken, ensureInstagramVerifyToken, embedded]);

  return (
    <div className={embedded ? 'pt-0' : 'pt-4 border-t border-dashed border-gray-300'}>
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="w-4 h-4 text-slate-600 shrink-0" aria-hidden />
        <h3 className="text-sm font-semibold text-slate-800">{t('whatsappConnect.webhookConfigTitle', 'Webhook configuration')}</h3>
        {isMetaWebhook && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex text-slate-400 hover:text-slate-600 cursor-help" aria-label="Info">
                <Info className="w-3.5 h-3.5 shrink-0" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">
                {isFacebook
                  ? t(
                      'facebookConnect.webhookReceiveHint',
                      'Agar Messenger masuk ke livechat: di Meta Developer → App → Webhooks (Page), isi Callback URL dan Verify Token di bawah, Verify and Save, lalu subscribe messages.',
                    )
                  : t(
                      'instagramConnect.webhookReceiveHint',
                      'Agar DM masuk ke aplikasi: di Meta Developer → App Anda → Instagram → Configuration → Webhook, isi Callback URL dan Verify Token di bawah, klik Verify and Save, lalu subscribe ke "messages".',
                    )}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="space-y-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
          <Label className="text-slate-700 text-xs font-medium uppercase tracking-wide">Webhook Callback URL</Label>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={webhookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline break-all flex-1 min-w-0"
            >
              {webhookUrl}
            </a>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => copyToClipboard(webhookUrl)}>
              Copy
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden />
            <Label className="text-slate-700 text-xs font-medium uppercase tracking-wide">Verify Token</Label>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono bg-white border border-slate-200 px-2.5 py-1.5 rounded flex-1 min-w-0 truncate">
              {verifyToken ?? verifyTokenPlaceholder}
            </span>
            {verifyToken && (
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => copyToClipboard(verifyToken)}>
                Copy
              </Button>
            )}
          </div>
          {isMetaWebhook && verifyToken && (
            <p className="text-xs text-slate-500 leading-relaxed">
              {t(
                isFacebook ? 'facebookConnect.verifyTokenReverifyHint' : 'instagramConnect.verifyTokenReverifyHint',
                'After connecting, copy this token to Meta Developer if it changed, then Verify and Save.',
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
