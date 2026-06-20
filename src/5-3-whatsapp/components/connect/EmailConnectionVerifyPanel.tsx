import { AlertTriangle, Copy, MessageCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { SUPABASE_URL } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';
import type { EmailConnection } from '../../types';

const EMAIL_INBOUND_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/email-inbound`;

type EmailConnectionVerifyPanelProps = {
  connection: EmailConnection;
  onOpenLiveChat: () => void;
  onSyncImap?: (connectionId: string) => void;
  isSyncingImap?: boolean;
};

function formatSyncTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function EmailConnectionVerifyPanel({
  connection,
  onOpenLiveChat,
  onSyncImap,
  isSyncingImap,
}: EmailConnectionVerifyPanelProps) {
  const { t } = useAppTranslation();
  const isImap = connection.connection_method === 'imap';
  const isVerified = connection.status === 'verified' || Boolean(connection.confirmation_code?.trim());

  if (isImap) {
    if (connection.imap_sync_error) {
      return (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50/90 p-3 text-xs text-red-950">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {t('emailConnect.imapSyncErrorTitle', 'Sinkron IMAP gagal')}
          </div>
          <p className="mb-2 break-words">{connection.imap_sync_error}</p>
          {onSyncImap ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-red-300 bg-white"
              disabled={isSyncingImap}
              onClick={() => onSyncImap(connection.id)}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isSyncingImap ? 'animate-spin' : ''}`} />
              {t('emailConnect.imapSyncRetry', 'Coba sinkron lagi')}
            </Button>
          ) : null}
        </div>
      );
    }
    if (!connection.imap_last_sync_at) {
      return (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
            {t('emailConnect.imapSyncPending', 'Menunggu sinkron pertama…')}
          </div>
          <p>{t('emailConnect.imapSyncPendingHint', 'Email masuk akan muncul di Live Chat sebentar lagi.')}</p>
        </div>
      );
    }
    return (
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>
          {t('emailConnect.imapLastSync', 'Sinkron terakhir: {{time}}', {
            time: formatSyncTime(connection.imap_last_sync_at) ?? '—',
          })}
        </span>
        {onSyncImap ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-blue-600 hover:text-blue-700"
            disabled={isSyncingImap}
            onClick={() => onSyncImap(connection.id)}
          >
            <RefreshCw className={`mr-1 h-3 w-3 ${isSyncingImap ? 'animate-spin' : ''}`} />
            {t('emailConnect.imapSyncRetry', 'Coba sinkron lagi')}
          </Button>
        ) : null}
      </div>
    );
  }

  if (isVerified) return null;

  const copyInbound = () => {
    void navigator.clipboard.writeText(connection.inbound_address).then(() => {
      toast.success(t('emailConnect.copied', 'Address copied to clipboard.'));
    });
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
      <p className="text-sm font-medium text-amber-900">
        {t('emailConnect.verifyStepsTitle', 'Langkah verifikasi')}
      </p>
      <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-amber-950">
        <li>
          {t(
            'emailConnect.verifyStepHostingerForward',
            'Di hPanel Hostinger → Forwarders: arahkan {{email}} ke alamat inbound di bawah.',
            { email: connection.email_address },
          )}
        </li>
        <li>
          {t(
            'emailConnect.verifyStepLiveChatLink',
            'Jika status Hostinger "Menunggu konfirmasi", buka Live Chat — email verifikasi Hostinger akan muncul di sana. Klik link verifikasi di dalam email.',
          )}
        </li>
      </ol>

      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded border border-amber-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-800">
          {connection.inbound_address}
        </code>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={copyInbound}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>

      {connection.confirmation_code ? (
        <div className="rounded border border-amber-300 bg-white px-3 py-2">
          <p className="text-xs text-amber-800">
            {t('emailConnect.confirmationCodeLabel', 'Kode konfirmasi (tempel di Gmail → Penerusan dan POP/IMAP)')}
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-amber-900">{connection.confirmation_code}</p>
        </div>
      ) : null}

      <Button type="button" size="sm" className="w-full" onClick={onOpenLiveChat}>
        <MessageCircle className="mr-2 h-4 w-4" />
        {t('emailConnect.openLiveChatForVerify', 'Buka Live Chat — cek email verifikasi')}
      </Button>

      <div className="rounded-lg border border-red-200 bg-red-50/90 p-3 text-xs leading-relaxed text-red-950">
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {t('emailConnect.verifyEmptyLiveChatTitle', 'Live Chat kosong?')}
        </div>
        <p className="mb-2">
          {t(
            'emailConnect.verifyEmptyLiveChatHintForward',
            'Pastikan forwarder Hostinger sudah dikonfirmasi dan Resend Inbound untuk domain profitloop.id aktif.',
          )}
        </p>
        <p className="mb-1 font-medium">{t('emailConnect.verifyResendChecklistTitle', 'Admin — cek Resend Inbound:')}</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>{t('emailConnect.verifyResendDomain', 'Domain profitloop.id aktif di Resend → Inbound (MX terverifikasi).')}</li>
          <li>
            {t('emailConnect.verifyResendWebhook', 'Webhook URL:')}
            <code className="mt-1 block break-all rounded bg-white/80 px-1 py-0.5 font-mono text-[10px]">
              {EMAIL_INBOUND_WEBHOOK_URL}
            </code>
          </li>
          <li>{t('emailConnect.verifyResendSecrets', 'Supabase secrets: RESEND_API_KEY + RESEND_WEBHOOK_SECRET.')}</li>
        </ul>
      </div>
    </div>
  );
}
