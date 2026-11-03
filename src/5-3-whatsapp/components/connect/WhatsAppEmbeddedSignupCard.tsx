import React, { useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Smartphone, Server, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { type EmbeddedSignupMode, useWhatsAppEmbeddedSignup } from '../../hooks/useWhatsAppEmbeddedSignup';

type Props = {
  /** Refresh the connected accounts list after a successful connect. */
  onConnected?: () => void | Promise<void>;
};

export function WhatsAppEmbeddedSignupCard({ onConnected }: Props) {
  const { t } = useAppTranslation();
  const { connect, loading, isConfigured } = useWhatsAppEmbeddedSignup();
  const [mode, setMode] = useState<EmbeddedSignupMode>('coexistence');
  const [pinNotice, setPinNotice] = useState<string | null>(null);

  const options: Array<{
    value: EmbeddedSignupMode;
    icon: React.ReactNode;
    title: string;
    description: string;
    points: string[];
    recommended?: boolean;
  }> = [
    {
      value: 'coexistence',
      icon: <Smartphone className="h-4 w-4" />,
      title: t('whatsappConnect.coexTitle', 'Coexistence'),
      description: t('whatsappConnect.coexDescription', 'Tetap pakai aplikasi WhatsApp Business di HP, chat juga masuk ke Synckerja.'),
      points: [
        t('whatsappConnect.coexPoint1', 'Admin tetap bisa membalas dari HP'),
        t('whatsappConnect.coexPoint2', 'Riwayat chat 180 hari ikut tersalin'),
        t('whatsappConnect.coexPoint3', 'Fitur API terbatas (20 pesan/detik, tanpa broadcast list di HP)'),
      ],
      recommended: true,
    },
    {
      value: 'cloud_api',
      icon: <Server className="h-4 w-4" />,
      title: t('whatsappConnect.cloudTitle', 'Cloud API'),
      description: t('whatsappConnect.cloudDescription', 'Nomor dikelola penuh lewat API. Untuk volume besar.'),
      points: [
        t('whatsappConnect.cloudPoint1', 'Throughput tinggi, fitur API lengkap'),
        t('whatsappConnect.cloudPoint2', 'Nomor tidak bisa lagi dipakai di aplikasi WhatsApp'),
      ],
    },
  ];

  const handleConnect = async () => {
    setPinNotice(null);
    try {
      const result = await connect(mode);
      const names = result.numbers.map((n) => n.verified_name || n.display_phone_number || n.phone_number_id).join(', ');
      toast.success(t('whatsappConnect.esConnected', 'WhatsApp terhubung: {{names}}', { names }));
      const syncError = result.numbers.find((n) => n.sync?.error)?.sync?.error;
      if (syncError) {
        toast.warning(t('whatsappConnect.esSyncWarning', 'Terhubung, tapi sinkron riwayat gagal: {{error}}. Coba "Ulangi sinkron riwayat" dalam 24 jam.', { error: syncError }));
      }
      const pin = result.numbers.find((n) => n.two_step_pin)?.two_step_pin;
      if (pin) setPinNotice(pin);
      await onConnected?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('whatsappConnect.esFailed', 'Gagal menghubungkan WhatsApp.'));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">
          {t('whatsappConnect.esHeading', 'Hubungkan dengan Meta')}
        </h3>
        <p className="text-xs text-slate-500">
          {t('whatsappConnect.esSubheading', 'Login Facebook, pilih bisnis dan nomor. ID dan token tersimpan otomatis.')}
        </p>
      </div>

      <div className="flex flex-col gap-3" role="radiogroup" aria-label={t('whatsappConnect.esModeLabel', 'Mode koneksi')}>
        {options.map((option) => {
          const selected = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMode(option.value)}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                selected ? 'border-[#25D366] bg-[#25D366]/5 ring-1 ring-[#25D366]' : 'border-slate-200 hover:border-slate-300',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  selected ? 'border-[#25D366]' : 'border-slate-300',
                )}
              >
                {selected ? <span className="h-2 w-2 rounded-full bg-[#25D366]" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-800">
                  <span className="shrink-0 text-slate-600">{option.icon}</span>
                  <span className="text-sm font-semibold">{option.title}</span>
                  {option.recommended ? (
                    <span className="rounded bg-[#25D366]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#128C7E]">
                      {t('whatsappConnect.esRecommended', 'Disarankan')}
                    </span>
                  ) : null}
                </span>
                <span className="mb-1.5 block text-xs text-slate-600">{option.description}</span>
                <span className="block space-y-0.5 text-[11px] leading-snug text-slate-500">
                  {option.points.map((point) => (
                    <span key={point} className="flex gap-1.5">
                      <span aria-hidden="true">•</span>
                      <span>{point}</span>
                    </span>
                  ))}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        className="w-full bg-[#25D366] text-white hover:bg-[#1ebe57]"
        onClick={handleConnect}
        disabled={!isConfigured || loading}
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        {loading
          ? t('whatsappConnect.esConnecting', 'Menghubungkan…')
          : t('whatsappConnect.esButton', 'Hubungkan dengan Meta')}
      </Button>

      {!isConfigured ? (
        <p className="text-xs text-amber-700">
          {t('whatsappConnect.esNotConfigured', 'Belum aktif: atur VITE_META_APP_ID dan VITE_META_WA_EMBEDDED_SIGNUP_CONFIG_ID.')}
        </p>
      ) : null}

      {pinNotice ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          {t('whatsappConnect.esPinNotice', 'Simpan PIN verifikasi dua langkah nomor ini: {{pin}}. PIN hanya ditampilkan sekali.', { pin: pinNotice })}
        </div>
      ) : null}
    </div>
  );
}
