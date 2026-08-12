import { Badge } from '@/shared/components/ui/badge';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { MetaAdsSyncUploadRecord } from '@/5-3-dashboard/hooks/useMetaAdsConversionUploadsMap';

type LeadMetaAdsSyncCellProps = {
  isConverted: boolean;
  sync: MetaAdsSyncUploadRecord | null;
  loading?: boolean;
  uploadsEnabled?: boolean;
};

export function LeadMetaAdsSyncCell({
  isConverted,
  sync,
  loading,
  uploadsEnabled = true,
}: LeadMetaAdsSyncCellProps) {
  const { t } = useAppTranslation();

  if (!isConverted) {
    return <span className="inline-flex w-[100px] justify-center text-sm text-muted-foreground">—</span>;
  }

  if (!uploadsEnabled) {
    return (
      <Badge
        className="w-[100px] justify-center rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600"
        title={t(
          'leadsManagement.metaAdsSync.uploadsOffHint',
          'Offline conversion uploads are disabled in Meta Ads settings.',
        )}
      >
        {t('leadsManagement.metaAdsSync.uploadsOff', 'Off')}
      </Badge>
    );
  }

  if (loading && !sync) {
    return (
      <span className="inline-flex w-[100px] justify-center text-xs text-muted-foreground">…</span>
    );
  }

  if (!sync) {
    return (
      <span
        className="inline-flex w-[100px] justify-center text-xs text-muted-foreground"
        title={t('leadsManagement.metaAdsSync.pendingHint', 'No upload log yet; refresh after a few seconds.')}
      >
        —
      </span>
    );
  }

  if (sync.status === 'success') {
    const kind = sync.upload_kind;
    const label =
      kind === 'ctwa'
        ? t('leadsManagement.metaAdsSync.successCtwa', 'CTWA')
        : kind === 'both'
          ? t('leadsManagement.metaAdsSync.successBoth', 'Both')
          : t('leadsManagement.metaAdsSync.success', 'OK');
    const hint =
      kind === 'ctwa'
        ? t(
            'leadsManagement.metaAdsSync.successCtwaHint',
            'Click-to-WhatsApp offline conversion sent to Meta',
          )
        : kind === 'both'
          ? t(
              'leadsManagement.metaAdsSync.successBothHint',
              'Meta Pixel and Click-to-WhatsApp conversions sent',
            )
          : t('leadsManagement.metaAdsSync.successHint', 'Offline conversion sent to Meta Ads');
    return (
      <Badge
        className="w-[100px] justify-center rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800"
        title={hint}
      >
        {label}
      </Badge>
    );
  }

  if (sync.status === 'skipped') {
    const reason = sync.skip_reason?.trim() || '';
    const skippedHint =
      reason === 'no_ctwa_or_fbclid_or_contact'
        ? t(
            'leadsManagement.metaAdsSync.skippedNoAttributionHint',
            'Skipped (no fbclid, CTWA click ID, or contact)',
          )
        : reason || t('leadsManagement.metaAdsSync.skippedHint', 'Skipped (no fbclid/contact)');
    return (
      <Badge
        className="w-[100px] justify-center rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600"
        title={skippedHint}
      >
        {t('leadsManagement.metaAdsSync.skipped', 'Skip')}
      </Badge>
    );
  }

  const err = sync.error_message?.trim() || '';
  return (
    <Badge
      className="w-[100px] justify-center rounded-sm border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
      title={err || t('leadsManagement.metaAdsSync.failedHint', 'Meta Ads upload failed')}
    >
      {t('leadsManagement.metaAdsSync.failed', 'Fail')}
    </Badge>
  );
}
