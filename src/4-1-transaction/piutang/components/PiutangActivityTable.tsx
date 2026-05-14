import { Button } from '@/shared/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { Badge } from '@/shared/components/ui/badge';
import type { SalesActivity } from '@/shared/hooks/organized/sales';
import type { PiutangVerificationAggregate } from '../types/piutang.types';
import { getPiutangRemaining, verificationAggregateLabel } from '../utils/piutangFilter';

const TABLE_SCROLL =
  'scrollbar-hide seamless-scroll min-h-0 min-w-0 flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

type PiutangActivityTableProps = {
  rows: SalesActivity[];
  loading?: boolean;
  verificationByActivity: ReadonlyMap<string, PiutangVerificationAggregate>;
  verificationLoading?: boolean;
  onOpenPayments: (row: SalesActivity) => void;
};

function serviceLabel(row: SalesActivity): string {
  const services = row.services as { name?: string } | null | undefined;
  const sub = row.sub_services as { name?: string } | null | undefined;
  const a = services?.name?.trim();
  const b = sub?.name?.trim();
  if (a && b) return `${a} · ${b}`;
  return a || b || '—';
}

export function PiutangActivityTable({
  rows,
  loading,
  verificationByActivity,
  verificationLoading,
  onOpenPayments,
}: PiutangActivityTableProps) {
  if (loading) {
    return null;
  }

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
                const remaining = getPiutangRemaining(row);
                const paid = Number(row.total_paid_amount ?? 0);
                const total = Number(row.total_amount ?? 0);
                const status = String(row.payment_status ?? (remaining <= 0 ? 'paid' : 'partial'));
                const vAgg = verificationByActivity.get(row.id) ?? 'none';
                const vLabel = verificationAggregateLabel(vAgg);
                const badgeVariant =
                  vAgg === 'approved' ? 'default' : vAgg === 'rejected' ? 'destructive' : 'secondary';
                return (
                  <TableRow key={row.id} className="hover:bg-gray-50">
                    <TableCell className="min-w-[140px] w-[160px] px-3 py-2 text-xs font-medium">
                      <div className="line-clamp-2 break-words leading-snug">{row.client_name ?? '—'}</div>
                    </TableCell>
                    <TableCell className="min-w-[180px] px-3 py-2 text-xs">
                      <div className="text-wrap break-words">{serviceLabel(row)}</div>
                    </TableCell>
                    <TableCell className="min-w-[110px] px-3 py-2 text-right text-xs tabular-nums">
                      {formatToRupiah(total)}
                    </TableCell>
                    <TableCell className="min-w-[100px] px-3 py-2 text-right text-xs font-semibold tabular-nums text-green-600">
                      {formatToRupiah(paid)}
                    </TableCell>
                    <TableCell className="min-w-[100px] px-3 py-2 text-right text-xs font-semibold tabular-nums">
                      {formatToRupiah(Math.max(0, remaining))}
                    </TableCell>
                    <TableCell className="min-w-[90px] px-3 py-2 text-xs capitalize text-gray-700">
                      {status.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell className="min-w-[100px] px-3 py-2 text-xs">
                      {verificationLoading ? (
                        <span className="text-gray-400">…</span>
                      ) : vAgg === 'none' ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <Badge variant={badgeVariant} className="font-normal">
                          {vLabel}
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
