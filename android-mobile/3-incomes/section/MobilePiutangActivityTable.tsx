import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import {
  buildPiutangRowViewModel,
  type PiutangActivityTableBaseProps,
} from '@/4-1-transaction/piutang/shared/piutangRowDisplay';
import { MOBILE_WIDE_FINANCE_TABLE_VIEWPORT_CLASS } from '@/mobile/shared/mobileWideFinanceTableViewport';

const TH =
  'whitespace-nowrap bg-slate-500 px-2 py-2 text-left text-xs font-medium text-slate-100';

export function MobilePiutangActivityTable({
  rows,
  verificationByActivity,
  verificationLoading,
  onOpenPayments,
}: PiutangActivityTableBaseProps) {
  const { t } = useAppTranslation();

  const scrollViewportClass = cn(
    'nested-scroll-touch-chain min-h-0 min-w-0 overflow-x-auto overflow-y-auto seamless-scroll [touch-action:pan-x_pan-y]',
    'scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
    MOBILE_WIDE_FINANCE_TABLE_VIEWPORT_CLASS,
    'shrink-0',
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className={scrollViewportClass}>
        <table className="w-full min-w-[1040px] select-none border-collapse">
          <thead className="sticky top-0 z-10 border-b border-slate-400/50 bg-slate-500">
            <tr>
              <th className={cn(TH, 'w-[120px] min-w-[120px] max-w-[120px]')}>
                {t('incomes.piutang.table.client', 'Klien')}
              </th>
              <th className={TH}>{t('incomes.piutang.table.service', 'Layanan')}</th>
              <th className={cn(TH, 'text-right')}>
                {t('incomes.piutang.table.totalContract', 'Total kontrak')}
              </th>
              <th className={cn(TH, 'text-right')}>
                {t('incomes.piutang.table.paid', 'Terbayar')}
              </th>
              <th className={cn(TH, 'text-right')}>{t('incomes.piutang.table.remaining', 'Sisa')}</th>
              <th className={cn(TH, 'w-[90px] min-w-[90px]')}>
                {t('incomes.piutang.table.status', 'Status')}
              </th>
              <th className={cn(TH, 'w-[100px] min-w-[100px]')}>
                {t('incomes.piutang.table.verification', 'Verifikasi')}
              </th>
              <th className={cn(TH, 'w-[120px] min-w-[120px]')}>
                {t('incomes.piutang.table.actions', 'Aksi')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="h-16 text-center text-xs text-muted-foreground">
                  {t('incomes.piutang.table.empty', 'Tidak ada data piutang untuk filter ini.')}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const vm = buildPiutangRowViewModel(row, verificationByActivity);
                return (
                  <tr
                    key={vm.id}
                    className="border-b border-border hover:bg-muted/30 active:bg-muted/50"
                  >
                    <td className="w-[120px] min-w-[120px] max-w-[120px] px-3 py-2 text-xs font-medium">
                      <div className="line-clamp-2 break-words leading-snug">{vm.clientName}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div>{vm.servicePrimary}</div>
                      {vm.serviceSecondary ? (
                        <div className="text-xs text-muted-foreground">{vm.serviceSecondary}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{vm.totalFormatted}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-green-600">
                      {vm.paidFormatted}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">
                      {vm.remainingFormatted}
                    </td>
                    <td className="w-[90px] min-w-[90px] px-3 py-2 text-xs capitalize text-foreground">
                      {vm.statusLabel}
                    </td>
                    <td className="w-[100px] min-w-[100px] px-3 py-2 text-xs">
                      {verificationLoading ? (
                        <span className="text-muted-foreground">…</span>
                      ) : vm.verificationAggregate === 'none' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge variant={vm.verificationBadgeVariant} className="text-xs font-normal">
                          {vm.verificationLabel}
                        </Badge>
                      )}
                    </td>
                    <td className="w-[120px] min-w-[120px] whitespace-nowrap px-3 py-2 text-left text-xs">
                      <button
                        type="button"
                        onClick={() => onOpenPayments(row)}
                        className="touch-manipulation rounded-sm px-1 text-xs font-medium text-blue-600 hover:text-blue-800 active:text-blue-900"
                      >
                        {t('incomes.piutang.table.paymentDetail', 'Detail pembayaran')}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
