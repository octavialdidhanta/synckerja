import type { GatewayPeriodNet } from '@/shared/hooks/finance/useGatewayWalletPeriodNet';
import type { BankAccountPeriodNetMap } from './buildBankAccountPeriodNet';

/** Operating income only (excludes Xendit gateway withdrawal transfers). */
export function sumBankPeriodIncome(
  bankAccountNet: BankAccountPeriodNetMap,
  selectedBankAccount: string,
): number {
  if (selectedBankAccount !== 'all') {
    return bankAccountNet[selectedBankAccount]?.operatingIncome ?? 0;
  }
  return Object.values(bankAccountNet).reduce((sum, row) => sum + row.operatingIncome, 0);
}

export function sumBankGatewayTransferIn(
  bankAccountNet: BankAccountPeriodNetMap,
  selectedBankAccount: string,
): number {
  if (selectedBankAccount !== 'all') {
    return bankAccountNet[selectedBankAccount]?.gatewayTransferIn ?? 0;
  }
  return Object.values(bankAccountNet).reduce((sum, row) => sum + row.gatewayTransferIn, 0);
}

/**
 * Total period income across bank + Xendit gateway drawer (Brick excluded from dashboard UI).
 * Gateway withdrawal bank credits are excluded — they are internal transfers, not revenue.
 */
export function sumDrawerPeriodIncome(
  bankAccountNet: BankAccountPeriodNetMap,
  selectedBankAccount: string,
  gatewayPeriodNet: { brick?: GatewayPeriodNet; xendit?: GatewayPeriodNet } | null | undefined,
  options: { xenditEligible?: boolean } = {},
): number {
  const bank = sumBankPeriodIncome(bankAccountNet, selectedBankAccount);
  if (selectedBankAccount !== 'all') return bank;

  const xendit = options.xenditEligible ? (gatewayPeriodNet?.xendit?.income ?? 0) : 0;
  return bank + xendit;
}
