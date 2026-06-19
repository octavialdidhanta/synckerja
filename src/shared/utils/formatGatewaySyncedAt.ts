import { formatMutationDateTime } from '@/shared/utils/formatMutationDateTime';

type TranslateFn = (key: string, fallback: string, options?: Record<string, unknown>) => string;

export function formatGatewaySyncedAtAbsolute(iso: string | null | undefined): string {
  return formatMutationDateTime(iso);
}

export function formatGatewaySyncedAtLabel(
  iso: string | null | undefined,
  t: TranslateFn,
): string {
  if (!iso) {
    return t('xendit.finance.lastSyncUnknown', 'Terakhir sync: —');
  }
  return t('xendit.finance.lastSyncAt', 'Terakhir sync: {{at}}', {
    at: formatGatewaySyncedAtAbsolute(iso),
  });
}
