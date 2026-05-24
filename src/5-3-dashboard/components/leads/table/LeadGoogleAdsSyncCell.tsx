import { Badge } from '@/shared/components/ui/badge';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { GoogleAdsSyncUploadRecord } from '@/5-3-dashboard/hooks/useGoogleAdsConversionUploadsMap';

type LeadGoogleAdsSyncCellProps = {
  isConverted: boolean;
  sync: GoogleAdsSyncUploadRecord | null;
  loading?: boolean;
};

export function LeadGoogleAdsSyncCell({ isConverted, sync, loading }: LeadGoogleAdsSyncCellProps) {
  const { t } = useAppTranslation();

  if (!isConverted) {
    return <span className="inline-flex w-[100px] justify-center text-sm text-muted-foreground">—</span>;
  }

  if (loading && !sync) {
    return (
      <span className="inline-flex w-[100px] justify-center text-xs text-muted-foreground">
        …
      </span>
    );
  }

  if (!sync) {
    return (
      <span
        className="inline-flex w-[100px] justify-center text-xs text-muted-foreground"
        title={t(
          'leadsManagement.googleAdsSync.pendingHint',
          'Belum ada log upload; refresh halaman setelah beberapa detik.',
        )}
      >
        —
      </span>
    );
  }

  if (sync.status === 'success') {
    return (
      <Badge
        className="w-[100px] justify-center rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800"
        title={t('leadsManagement.googleAdsSync.successHint', 'Offline conversion terkirim ke Google Ads')}
      >
        {t('leadsManagement.googleAdsSync.success', 'Berhasil')}
      </Badge>
    );
  }

  if (sync.status === 'skipped') {
    const reason = sync.skip_reason?.trim() || '';
    return (
      <Badge
        className="w-[100px] justify-center rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600"
        title={
          reason ||
          t('leadsManagement.googleAdsSync.skippedHint', 'Upload dilewati (tanpa gclid/kontak)')
        }
      >
        {t('leadsManagement.googleAdsSync.skipped', 'Dilewati')}
      </Badge>
    );
  }

  const err = sync.error_message?.trim() || '';
  return (
    <Badge
      className="w-[100px] justify-center rounded-sm border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
      title={err || t('leadsManagement.googleAdsSync.failedHint', 'Upload ke Google Ads gagal')}
    >
      {t('leadsManagement.googleAdsSync.failed', 'Gagal')}
    </Badge>
  );
}
