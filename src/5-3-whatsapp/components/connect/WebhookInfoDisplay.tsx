import React from 'react';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { useWhatsAppConfig } from '../../hooks/useWhatsAppConfig';
import { useInstagramAccounts } from '../../hooks/useInstagramAccounts';
import { useFacebookPages } from '../../hooks/useFacebookPages';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { SUPABASE_URL } from '@/shared/lib/supabaseClient';
import { cn } from '@/shared/lib/utils';
import { Link2, Info } from 'lucide-react';

const WHATSAPP_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
const INSTAGRAM_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/instagram-webhook`;
const THREADS_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/threads-webhook`;

interface WebhookInfoDisplayProps {
  /** When true, no top border (e.g. when inside a single Card with other sections) */
  embedded?: boolean;
  /** Shorter layout — hides step-by-step boxes (Facebook/Threads). */
  compact?: boolean;
  /** 'whatsapp' | 'instagram' | 'facebook' | 'threads'. Messenger uses instagram-webhook URL. */
  variant?: 'whatsapp' | 'instagram' | 'facebook' | 'threads';
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export function WebhookInfoDisplay({ embedded, compact, variant = 'whatsapp' }: WebhookInfoDisplayProps) {
  const { config, ensureInstagramVerifyToken } = useWhatsAppConfig();
  const { accounts: igAccounts } = useInstagramAccounts();
  const { pages: fbPages } = useFacebookPages();
  const { t } = useAppTranslation();
  const hasEnsuredIgToken = React.useRef(false);

  const isInstagram = variant === 'instagram';
  const isFacebook = variant === 'facebook';
  const isThreads = variant === 'threads';
  const isMetaWebhook = isInstagram || isFacebook || isThreads;
  const threadsAccount = igAccounts.find((a) => a.has_threads);
  const webhookUrl = isThreads
    ? THREADS_WEBHOOK_URL
    : isMetaWebhook
      ? INSTAGRAM_WEBHOOK_URL
      : WHATSAPP_WEBHOOK_URL;
  const verifyToken = isThreads
    ? (
        (threadsAccount as { threads_verify_token?: string | null } | undefined)?.threads_verify_token?.trim()
        || threadsAccount?.verify_token?.trim()
        || null
      )
    : isFacebook
      ? (fbPages?.[0]?.verify_token?.trim() || null)
      : isInstagram
        ? (igAccounts?.[0]?.verify_token ?? config?.instagram_verify_token ?? null)
        : (config?.verify_token ?? null);
  const verifyTokenPlaceholder = isThreads
    ? (threadsAccount ? null : t('threadsConnect.verifyTokenPlaceholder', '— Connect Threads dulu untuk melihat Verify Token —'))
    : isFacebook
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
      {!compact && (
        <div className={cn('flex items-center gap-2', 'mb-4')}>
          <Link2 className="w-4 h-4 text-slate-600 shrink-0" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-800">
            {t('whatsappConnect.webhookConfigTitle', 'Webhook configuration')}
          </h3>
          {isMetaWebhook && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex text-slate-400 hover:text-slate-600 cursor-help" aria-label="Info">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  {isThreads
                    ? t(
                        'threadsConnect.webhookReceiveHint',
                        'Di Meta Developer → App Threads → Webhooks: isi Callback URL + Verify Token di bawah, Verify and Save, lalu subscribe field replies dan mentions.',
                      )
                    : isFacebook
                      ? t(
                          'facebookConnect.webhookReceiveHint',
                          'Meta Developer → Webhooks → product Page → paste URL & token → subscribe messages.',
                        )
                      : t(
                          'instagramConnect.webhookReceiveHint',
                          'Agar DM dan komentar IG masuk ke aplikasi: di Meta Developer → App Anda → Instagram → Configuration → Webhook, isi Callback URL dan Verify Token di bawah, klik Verify and Save. Synckerja subscribe otomatis ke messages + comments saat connect — reconnect atau tombol Subscribe webhooks jika akun sudah lama terhubung.',
                        )}
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
      {isThreads && !compact && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/90 p-3 text-xs leading-relaxed text-slate-800">
          <p className="font-semibold">
            {t('threadsConnect.webhookSetupTitle', 'Setup webhook di Meta (Threads API app)')}
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              {t(
                'threadsConnect.webhookStep1',
                'developers.facebook.com → App "Connect Threads" → Use cases → Threads API → Webhooks.',
              )}
            </li>
            <li>
              {t(
                'threadsConnect.webhookStep2',
                'Callback URL + Verify Token di bawah → Verify and Save.',
              )}
            </li>
            <li>
              {t(
                'threadsConnect.webhookStep3',
                'Subscribe field replies dan mentions untuk Threads user @vialdi_wedding (tester).',
              )}
            </li>
            <li>
              {t(
                'threadsConnect.webhookStep4',
                'OAuth redirect URI wajib: https://office.synckerja.com/auth/threads/callback',
              )}
            </li>
          </ol>
        </div>
      )}
      {isFacebook && !compact && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-xs leading-relaxed text-amber-950">
          <p className="font-semibold">
            {t('facebookConnect.webhookPageNotUserTitle', 'Penting: pilih product "Page", bukan "User"')}
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              {t(
                'facebookConnect.webhookPageStep1',
                'Meta Developer → App → Webhooks → dropdown "Select product" → pilih Page (bukan User).',
              )}
            </li>
            <li>
              {t(
                'facebookConnect.webhookPageStep2',
                'Isi Callback URL + Verify Token di bawah → Verify and Save.',
              )}
            </li>
            <li>
              {t(
                'facebookConnect.webhookPageStep3',
                'Di tabel field Page, toggle Subscribe pada messages dan messaging_postbacks (jika tidak muncul: tambah product Messenger di App Dashboard).',
              )}
            </li>
            <li>
              {t(
                'facebookConnect.webhookPageStep3b',
                'Lead Magnet Facebook: tombol Sudah Follow/Ambil Materi buka halaman office.synckerja.com (two-step follow gate). Aktifkan messages di Meta jika ingin Livechat.',
              )}
            </li>
            <li>
              {t(
                'facebookConnect.webhookPageStep4',
                'Tombol "Enable Messenger webhooks" di Synckerja sudah subscribe via API — tetap wajib verify URL di Page di atas.',
              )}
            </li>
          </ol>
        </div>
      )}
      <div className={compact ? 'space-y-2' : 'space-y-5'}>
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 space-y-1.5">
          <Label className="text-slate-600 text-[11px] font-medium uppercase tracking-wide">
            {compact ? 'URL' : 'Webhook Callback URL'}
          </Label>
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
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 space-y-1.5">
          <Label className="text-slate-600 text-[11px] font-medium uppercase tracking-wide">
            {compact ? t('facebookConnect.verifyTokenShort', 'Token') : 'Verify Token'}
          </Label>
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
          {isMetaWebhook && verifyToken && !compact && (
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
