import { Button } from '@/shared/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import {
  buildPiutangRowViewModel,
  getPiutangServiceLabel,
  type PiutangActivityTableBaseProps,
} from '../shared/piutangRowDisplay';

const TABLE_SCROLL =
  'scrollbar-hide seamless-scroll min-h-0 min-w-0 flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export function PiutangActivityTable({
  rows,
  verificationByActivity,
  verificationLoading,
  onOpenPayments,
}: PiutangActivityTableBaseProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-gray-900">Piutang penjualan</h2>
        <div className="h-8 w-8 flex-shrink-0" aria-hidden />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Table containerClassName={TABLE_SCROLL}>
          <TableHeader className="sticky top-0 z-20">
            <TableRow className="bg-gray-50">
              <TableHead className="h-8 min-w-[140px] w-[160px] bg-gray-50 px-3 text-xs font-medium">Klien</TableHead>
              <TableHead className="h-8 min-w-[180px] bg-gray-50 px-3 text-xs font-medium">Layanan</TableHead>
              <TableHead className="h-8 min-w-[110px] bg-gray-50 px-3 text-right text-xs font-medium">
                Total kontrak
              </TableHead>
              <TableHead className="h-8 min-w-[100px] bg-gray-50 px-3 text-right text-xs font-medium">Terbayar</TableHead>
              <TableHead className="h-8 min-w-[100px] bg-gray-50 px-3 text-right text-xs font-medium">Sisa</TableHead>
              <TableHead className="h-8 min-w-[90px] bg-gray-50 px-3 text-xs font-medium">Status</TableHead>
              <TableHead className="h-8 min-w-[100px] bg-gray-50 px-3 text-xs font-medium">Verifikasi</TableHead>
              <TableHead className="h-8 w-[140px] min-w-[140px] bg-gray-50 px-3 text-right text-xs font-medium">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-16 text-center text-xs text-gray-500">
                  Tidak ada data piutang untuk filter ini.
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
                      {vm.statusLabel}
                    </TableCell>
                    <TableCell className="min-w-[100px] px-3 py-2 text-xs">
                      {verificationLoading ? (
                        <span className="text-gray-400">…</span>
                      ) : vm.verificationAggregate === 'none' ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <Badge variant={vm.verificationBadgeVariant} className="font-normal">
                          {vm.verificationLabel}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="w-[140px] min-w-[140px] px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => onOpenPayments(row)}
                      >
                        Detail pembayaran
                      </Button>
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
