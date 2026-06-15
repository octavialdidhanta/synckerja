import type { PiutangVerificationAggregate } from '../types/piutang.types';
import type { PiutangFilterOption } from './piutangFilterConfig';

type PiutangTranslate = (key: string, defaultValue?: string) => string;

export function translatePiutangFilterOption<T extends string>(
  t: PiutangTranslate,
  option: PiutangFilterOption<T>,
): string {
  return t(option.labelKey, option.label);
}

export function translatePiutangPaymentStatus(t: PiutangTranslate, raw: string): string {
  const normalized = raw.toLowerCase().replace(/\s+/g, '_');
  const key = `incomes.piutang.paymentStatus.${normalized}`;
  return t(key, raw.replace(/_/g, ' '));
}

export function translatePiutangVerificationAggregate(
  t: PiutangTranslate,
  aggregate: PiutangVerificationAggregate,
): string {
  if (aggregate === 'none') return '—';
  return t(`incomes.piutang.verification.${aggregate}`, aggregate);
}
