import type { SalesActivity } from '@/shared/hooks/organized/sales';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import type { PiutangVerificationAggregate } from '../types/piutang.types';
import { getPiutangRemaining, verificationAggregateLabel } from '../utils/piutangFilter';

export type PiutangActivityTableBaseProps = {
  rows: SalesActivity[];
  verificationByActivity: ReadonlyMap<string, PiutangVerificationAggregate>;
  verificationLoading?: boolean;
  onOpenPayments: (row: SalesActivity) => void;
};

export function getPiutangServiceLabel(row: SalesActivity): string {
  const services = row.services as { name?: string } | null | undefined;
  const sub = row.sub_services as { name?: string } | null | undefined;
  const a = services?.name?.trim();
  const b = sub?.name?.trim();
  if (a && b) return `${a} · ${b}`;
  return a || b || '—';
}

export function getPiutangServiceParts(row: SalesActivity): { primary: string; secondary?: string } {
  const services = row.services as { name?: string } | null | undefined;
  const sub = row.sub_services as { name?: string } | null | undefined;
  const primary = services?.name?.trim() || sub?.name?.trim() || '—';
  const secondary =
    services?.name?.trim() && sub?.name?.trim() ? sub.name.trim() : undefined;
  return { primary, secondary };
}

export function getPiutangVerificationBadgeVariant(
  aggregate: PiutangVerificationAggregate,
): 'default' | 'destructive' | 'secondary' {
  if (aggregate === 'approved') return 'default';
  if (aggregate === 'rejected') return 'destructive';
  return 'secondary';
}

export type PiutangRowViewModel = {
  id: string;
  clientName: string;
  servicePrimary: string;
  serviceSecondary?: string;
  total: number;
  paid: number;
  remaining: number;
  statusLabel: string;
  verificationAggregate: PiutangVerificationAggregate;
  verificationLabel: string;
  verificationBadgeVariant: 'default' | 'destructive' | 'secondary';
  totalFormatted: string;
  paidFormatted: string;
  remainingFormatted: string;
};

export function buildPiutangRowViewModel(
  row: SalesActivity,
  verificationByActivity: ReadonlyMap<string, PiutangVerificationAggregate>,
): PiutangRowViewModel {
  const remaining = getPiutangRemaining(row);
  const paid = Number(row.total_paid_amount ?? 0);
  const total = Number(row.total_amount ?? 0);
  const status = String(row.payment_status ?? (remaining <= 0 ? 'paid' : 'partial'));
  const verificationAggregate = verificationByActivity.get(row.id) ?? 'none';
  const { primary, secondary } = getPiutangServiceParts(row);

  return {
    id: row.id,
    clientName: row.client_name ?? '—',
    servicePrimary: primary,
    serviceSecondary: secondary,
    total,
    paid,
    remaining: Math.max(0, remaining),
    statusLabel: status.replace(/_/g, ' '),
    verificationAggregate,
    verificationLabel: verificationAggregateLabel(verificationAggregate),
    verificationBadgeVariant: getPiutangVerificationBadgeVariant(verificationAggregate),
    totalFormatted: formatToRupiah(total),
    paidFormatted: formatToRupiah(paid),
    remainingFormatted: formatToRupiah(Math.max(0, remaining)),
  };
}
