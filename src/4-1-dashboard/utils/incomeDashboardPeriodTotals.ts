import type { GatewayPeriodNet } from './useGatewayWalletPeriodNet';

type BankAccountNetMap = Record<string, { income: number; expense: number; net: number; balance: number }>;

/** Same income sum as bank rows in "Saldo per Laci Keuangan". */
export function sumBankPeriodIncome(
  bankAccountNet: BankAccountNetMap,
  selectedBankAccount: string,
): number {
  if (selectedBankAccount !== 'all') {
    return bankAccountNet[selectedBankAccount]?.income ?? 0;
  }
  return Object.values(bankAccountNet).reduce((sum, row) => sum + row.income, 0);
}

/**
 * Total period income across bank + Xendit gateway drawer (Brick excluded from dashboard UI).
 */
export function sumDrawerPeriodIncome(
  bankAccountNet: BankAccountNetMap,
  selectedBankAccount: string,
  gatewayPeriodNet: { brick?: GatewayPeriodNet; xendit?: GatewayPeriodNet } | null | undefined,
  options: { xenditEligible?: boolean } = {},
): number {
  const bank = sumBankPeriodIncome(bankAccountNet, selectedBankAccount);
  if (selectedBankAccount !== 'all') return bank;

  const xendit = options.xenditEligible ? (gatewayPeriodNet?.xendit?.income ?? 0) : 0;
  return bank + xendit;
}
