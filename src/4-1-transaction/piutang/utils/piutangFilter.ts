import type { PiutangFilterMode, PiutangVerificationAggregate, PiutangVerificationFilterMode } from '../types/piutang.types';

export type PiutangAmountFields = {
  total_amount?: number | null;
  total_paid_amount?: number | null;
};

/** Ringkasan per aktivitas untuk filter status "Terbuka" + filter verifikasi. */
export type PiutangVerificationFilterInfo = {
  paymentCount: number;
  hasUnchecked: boolean;
  hasRejected: boolean;
  /** Semua baris pembayaran berstatus approved. */
  allApproved: boolean;
};

export function getPiutangRemaining(row: PiutangAmountFields): number {
  const total = Number(row.total_amount ?? 0);
  const paid = Number(row.total_paid_amount ?? 0);
  return total - paid;
}

/**
 * Default list: paid > 0.
 * - `open`: ada sisa piutang **atau** sudah lunas tetapi masih ada pembayaran yang belum / ditolak verifikasi (perlu tindak lanjut).
 * - `settled`: lunas (sisa ≤ 0).
 * - `all`: ada pembayaran masuk.
 *
 * `verificationInfo` dipakai hanya untuk cabang `open` (opsional; jika tidak ada, `open` = sisa > 0 saja).
 */
export function matchesPiutangStatusFilter(
  row: PiutangAmountFields,
  mode: PiutangFilterMode,
  verificationInfo?: PiutangVerificationFilterInfo,
): boolean {
  const paid = Number(row.total_paid_amount ?? 0);
  if (paid <= 0) return false;
  const remaining = getPiutangRemaining(row);
  if (mode === 'open') {
    if (remaining > 0) return true;
    const pendingVerification =
      verificationInfo &&
      verificationInfo.paymentCount > 0 &&
      !verificationInfo.allApproved;
    return Boolean(pendingVerification);
  }
  if (mode === 'settled') return remaining <= 0;
  return true;
}

const STATUS_SET = new Set(['unchecked', 'approved', 'rejected']);

function normalizeVerificationStatus(raw: string | null | undefined): 'unchecked' | 'approved' | 'rejected' {
  const s = String(raw ?? 'unchecked').toLowerCase();
  return STATUS_SET.has(s) ? (s as 'unchecked' | 'approved' | 'rejected') : 'unchecked';
}

/**
 * Ringkas semua pembayaran satu aktivitas: ditolak > belum dicek > semua OK.
 * `none` jika tidak ada baris pembayaran.
 */
export function aggregateActivityVerification(
  payments: { transfer_verification_status?: string | null }[],
): PiutangVerificationAggregate {
  if (!payments.length) return 'none';
  const list = payments.map((p) => normalizeVerificationStatus(p.transfer_verification_status));
  if (list.some((s) => s === 'rejected')) return 'rejected';
  if (list.some((s) => s === 'unchecked')) return 'unchecked';
  if (list.every((s) => s === 'approved')) return 'approved';
  return 'unchecked';
}

export function buildVerificationFilterInfo(
  payments: { transfer_verification_status?: string | null }[],
): PiutangVerificationFilterInfo {
  if (!payments.length) {
    return { paymentCount: 0, hasUnchecked: false, hasRejected: false, allApproved: false };
  }
  let hasUnchecked = false;
  let hasRejected = false;
  for (const p of payments) {
    const s = normalizeVerificationStatus(p.transfer_verification_status);
    if (s === 'unchecked') hasUnchecked = true;
    if (s === 'rejected') hasRejected = true;
  }
  const allApproved = payments.every(
    (p) => normalizeVerificationStatus(p.transfer_verification_status) === 'approved',
  );
  return { paymentCount: payments.length, hasUnchecked, hasRejected, allApproved };
}

/**
 * Filter verifikasi per **baris pembayaran**, bukan satu label agregat:
 * - "Belum dicek" = ada minimal satu pembayaran unchecked (tetap tampil walau ada yang ditolak).
 * - "Ditolak" = ada minimal satu ditolak.
 * - "OK" = semua pembayaran approved.
 * Tanpa data pembayaran di cache: jangan sembunyikan baris piutang (tampilkan).
 */
export function activityMatchesPiutangVerificationFilter(
  info: PiutangVerificationFilterInfo | undefined,
  filter: PiutangVerificationFilterMode,
): boolean {
  if (filter === 'all') return true;
  if (!info || info.paymentCount === 0) return true;

  if (filter === 'unchecked') return info.hasUnchecked;
  if (filter === 'rejected') return info.hasRejected;
  if (filter === 'approved') return info.allApproved;
  return true;
}

export function verificationAggregateLabel(aggregate: PiutangVerificationAggregate): string {
  switch (aggregate) {
    case 'approved':
      return 'OK';
    case 'rejected':
      return 'Ditolak';
    case 'unchecked':
      return 'Belum dicek';
    default:
      return '—';
  }
}
