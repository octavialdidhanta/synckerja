import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { ClipboardCheck, Landmark, MoreHorizontal } from 'lucide-react';
import {
  buildPiutangRowViewModel,
  getPiutangServiceLabel,
  type PiutangActivityTableBaseProps,
} from '../shared/piutangRowDisplay';
import {
  translatePiutangPaymentStatus,
  translatePiutangVerificationAggregate,
} from '../shared/piutangI18n';

const TABLE_SCROLL =
  'scrollbar-hide seamless-scroll min-h-0 min-w-0 flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export function PiutangActivityTable({
  rows,
  verificationByActivity,
  verificationLoading,
  onOpenPayments,
  onOpenVaCollection,
}: PiutangActivityTableBaseProps) {
  const { t } = useAppTranslation();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-gray-900">
          {t('incomes.piutang.table.title', 'Piutang penjualan')}
        </h2>
        <div className="h-8 w-8 flex-shrink-0" aria-hidden />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Table containerClassName={TABLE_SCROLL}>
          <TableHeader className="sticky top-0 z-20">
            <TableRow className="bg-gray-50">
              <TableHead className="h-8 min-w-[140px] w-[160px] bg-gray-50 px-3 text-xs font-medium">
                {t('incomes.piutang.table.client', 'Klien')}
              </TableHead>
              <TableHead className="h-8 min-w-[180px] bg-gray-50 px-3 text-xs font-medium">
                {t('incomes.piutang.table.service', 'Layanan')}
              </TableHead>
              <TableHead className="h-8 min-w-[110px] bg-gray-50 px-3 text-right text-xs font-medium">
                {t('incomes.piutang.table.totalContract', 'Total kontrak')}
              </TableHead>
              <TableHead className="h-8 min-w-[100px] bg-gray-50 px-3 text-right text-xs font-medium">
                {t('incomes.piutang.table.paid', 'Terbayar')}
              </TableHead>
              <TableHead className="h-8 min-w-[100px] bg-gray-50 px-3 text-right text-xs font-medium">
                {t('incomes.piutang.table.remaining', 'Sisa')}
              </TableHead>
              <TableHead className="h-8 min-w-[90px] bg-gray-50 px-3 text-xs font-medium">
                {t('incomes.piutang.table.status', 'Status')}
              </TableHead>
              <TableHead className="h-8 min-w-[100px] bg-gray-50 px-3 text-xs font-medium">
                {t('incomes.piutang.table.verification', 'Verifikasi')}
              </TableHead>
              <TableHead className="h-8 w-[52px] min-w-[52px] bg-gray-50 px-2 text-right text-xs font-medium">
                {t('incomes.piutang.table.actions', 'Aksi')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-16 text-center text-xs text-gray-500">
                  {t('incomes.piutang.table.empty', 'Tidak ada data piutang untuk filter ini.')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const vm = buildPiutangRowViewModel(row, verificationByActivity);
                return (
                  <TableRow key={vm.id} className="hover:bg-gray-50">
                    <TableCell className="min-w-[140px] w-[160px] px-3 py-2 text-xs font-medium">
                      <div className="line-clamp-2 break-words leading-snug">{vm.clientName}</div>
                    </TableCell>
                    <TableCell className="min-w-[180px] px-3 py-2 text-xs">
                      <div className="text-wrap break-words">{getPiutangServiceLabel(row)}</div>
                    </TableCell>
                    <TableCell className="min-w-[110px] px-3 py-2 text-right text-xs tabular-nums">
                      {vm.totalFormatted}
                    </TableCell>
                    <TableCell className="min-w-[100px] px-3 py-2 text-right text-xs font-semibold tabular-nums text-green-600">
                      {vm.paidFormatted}
                    </TableCell>
                    <TableCell className="min-w-[100px] px-3 py-2 text-right text-xs font-semibold tabular-nums">
                      {vm.remainingFormatted}
                    </TableCell>
                    <TableCell className="min-w-[90px] px-3 py-2 text-xs capitalize text-gray-700">
                      {translatePiutangPaymentStatus(t, vm.statusLabel)}
                    </TableCell>
                    <TableCell className="min-w-[100px] px-3 py-2 text-xs">
                      {verificationLoading ? (
                        <span className="text-gray-400">…</span>
                      ) : vm.verificationAggregate === 'none' ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <Badge variant={vm.verificationBadgeVariant} className="font-normal">
                          {translatePiutangVerificationAggregate(t, vm.verificationAggregate)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="w-[52px] min-w-[52px] px-2 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label={t('incomes.piutang.table.actionsAria', 'Aksi piutang')}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => onOpenPayments(row)}>
                            <ClipboardCheck className="mr-2 h-4 w-4 text-gray-600" />
                            {t('incomes.piutang.table.verify', 'Verifikasi')}
                          </DropdownMenuItem>
                          {onOpenVaCollection ? (
                            <DropdownMenuItem onClick={() => onOpenVaCollection(row)}>
                              <Landmark className="mr-2 h-4 w-4 text-gray-600" />
                              {t('incomes.piutang.table.vaCollection', 'Koleksi VA')}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
