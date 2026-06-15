import { Badge } from '@/shared/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import type { GatewayPayoutValidationStatus } from '@/xendit/types/xendit';

type Props = {
  status: GatewayPayoutValidationStatus | string | null | undefined;
  errorMessage?: string | null;
  label: string;
  compact?: boolean;
};

function statusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'match') return 'default';
  if (status === 'pending' || status === 'stale') return 'secondary';
  if (status === 'none') return 'outline';
  return 'destructive';
}

export function GatewayPayoutValidationBadge({
  status,
  errorMessage,
  label,
  compact = false,
}: Props) {
  const safeStatus = status ?? 'none';
  const badge = (
    <Badge
      variant={statusVariant(safeStatus)}
      className={
        compact
          ? 'h-5 max-w-full truncate px-1.5 text-[10px] font-normal leading-none'
          : 'text-[10px]'
      }
    >
      {label}
    </Badge>
  );

  if (errorMessage && safeStatus !== 'match') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex max-w-full">{badge}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{errorMessage}</TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}

export function gatewayPayoutStatusLabel(
  status: GatewayPayoutValidationStatus | string | null | undefined,
  t: (key: string, fallback: string) => string,
): string {
  switch (status) {
    case 'match':
      return t('xendit.payoutValidation.badgeMatch', 'Rekening tervalidasi');
    case 'pending':
      return t('xendit.payoutValidation.badgePending', 'Memvalidasi…');
    case 'stale':
      return t('xendit.payoutValidation.badgeStale', 'Perlu validasi ulang');
    case 'unclear':
      return t('xendit.payoutValidation.badgeUnclear', 'Nama tidak pasti');
    case 'not_match':
      return t('xendit.payoutValidation.badgeNotMatch', 'Nama tidak cocok');
    case 'failed':
      return t('xendit.payoutValidation.badgeFailed', 'Rekening tidak ditemukan');
    case 'error':
      return t('xendit.payoutValidation.badgeError', 'Validasi gagal');
    default:
      return t('xendit.payoutValidation.badgeNone', 'Belum divalidasi');
  }
}

export function shouldShowGatewayPayoutStatus(
  bankAccount: {
    use_for_gateway_payout?: boolean;
    gateway_payout_validation_status?: string | null;
    gateway_payout_bank_code?: string | null;
  },
): boolean {
  const status = bankAccount.gateway_payout_validation_status;
  if (bankAccount.use_for_gateway_payout) return true;
  if (status && status !== 'none') return true;
  if (bankAccount.gateway_payout_bank_code) return true;
  return false;
}
