import { Link } from 'react-router-dom';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { formatGatewaySyncedAtLabel } from '@/shared/utils/formatGatewaySyncedAt';
import type { GatewayPeriodNet } from '@/shared/hooks/finance/useGatewayWalletPeriodNet';
import type { GatewayWalletRow } from '@/shared/hooks/finance/useGatewayWalletBalances';

type Props = {
  provider: 'brick' | 'xendit';
  wallet: GatewayWalletRow | null;
  periodNet?: GatewayPeriodNet;
  isStale?: boolean;
  subtitle?: string;
  subAccountCount?: number;
  settingsHref?: string;
  onSync?: () => void;
  syncing?: boolean;
};

export function GatewayWalletDrawerRow({
  provider,
  wallet,
  periodNet,
  isStale,
  subtitle,
  subAccountCount = 0,
  settingsHref,
  onSync,
  syncing,
}: Props) {
  const { t } = useAppTranslation();
  const label = provider === 'brick' ? 'Brick' : 'Xendit';
  const income = periodNet?.income ?? 0;
  const expense = periodNet?.expense ?? 0;
  const operatingExpense =
    provider === 'xendit' ? (periodNet?.operatingExpense ?? expense) : expense;
  const gatewayWithdrawalOut =
    provider === 'xendit' ? (periodNet?.gatewayWithdrawalOut ?? 0) : 0;
  const net = periodNet?.net ?? 0;
  const balance = Number(wallet?.usable_balance ?? 0);
  const pending = Number(wallet?.pending_balance ?? 0);
  const estimatedPeriodOpening = balance - net;

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-gray-900">
              {t('incomes.gateway.drawerTitle', 'Laci {{provider}}', { provider: label })}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase">
              {label}
            </Badge>
            {isStale || wallet?.sync_error ? (
              <Badge variant="destructive" className="text-[10px]">
                {wallet?.sync_error
                  ? t('incomes.gateway.syncError', 'Sync error')
                  : t('incomes.gateway.stale', 'Stale')}
              </Badge>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-gray-600">{subtitle}</p>
          ) : null}
          {provider === 'xendit' && subAccountCount > 1 ? (
            <p className="mt-0.5 text-[11px] text-gray-500">
              {t('incomes.gateway.xenditMultiSubAccount', 'Total {{count}} akun aktif', {
                count: subAccountCount,
              })}
            </p>
          ) : null}
          <div className="text-xs text-gray-700">
            {t('incomes.income', 'Income')}: {formatToRupiah(income)} |{' '}
            {provider === 'xendit'
              ? t('incomes.drawer.operatingExpense', 'Pengeluaran operasional')
              : t('incomes.expense', 'Expense')}
            : {formatToRupiah(operatingExpense)}
          </div>
          {provider === 'xendit' && gatewayWithdrawalOut > 0 ? (
            <div className="text-xs text-blue-700">
              {t('incomes.gateway.withdrawalOut', 'Penarikan ke bank')}: {formatToRupiah(gatewayWithdrawalOut)}
            </div>
          ) : null}
          {wallet?.sync_error ? (
            <p className="mt-1 text-xs text-red-600">{wallet.sync_error}</p>
          ) : (
            <p className="mt-0.5 text-[11px] text-gray-500">
              {formatGatewaySyncedAtLabel(wallet?.synced_at, t)}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {onSync ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-brand-blue hover:text-brand-blue"
                disabled={syncing}
                onClick={onSync}
              >
                <RefreshCw className={cn('mr-1 h-3 w-3', syncing && 'animate-spin')} />
                {t('incomes.gateway.syncBalance', 'Sync saldo')}
              </Button>
            ) : null}
            {settingsHref ? (
              <Link to={settingsHref} className="text-[11px] text-brand-blue hover:underline">
                {t('incomes.gateway.openSettings', 'Pengaturan {{provider}}', { provider: label })}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="ml-2 flex-shrink-0 text-right">
          <div className={`text-sm font-semibold ${net >= 0 ? 'text-green-800' : 'text-red-800'}`}>
            {t('incomes.net', 'Net')}: {formatToRupiah(net)}
          </div>
          <div className="text-xs font-medium text-gray-800">
            {t('incomes.balance', 'Balance')}: {formatToRupiah(balance)}
          </div>
          {pending > 0 ? (
            <div className="text-[11px] text-gray-600">
              {t('incomes.gateway.pending', 'Pending')}: {formatToRupiah(pending)}
            </div>
          ) : null}
          <div
            className="mt-0.5 max-w-[12rem] cursor-help text-xs text-gray-600"
            title={t(
              'incomes.netPerBankEstimatedOpeningHint',
              'Approx. balance at the start of the filtered period: current Balance minus Net.',
            )}
          >
            {t('incomes.netPerBankEstimatedOpening', 'Est. opening balance (period)')}:{' '}
            {formatToRupiah(estimatedPeriodOpening)}
          </div>
        </div>
      </div>
    </div>
  );
}
