import type { BankStatementLineWithMatch } from '@/4-1-dashboard/types/bank-mutations';

function getGatewayProvider(row: BankStatementLineWithMatch): string | null {
  const raw = row.raw_payload as Record<string, unknown> | undefined;
  const fromPayload =
    typeof raw?.gateway_wallet_provider === 'string' ? raw.gateway_wallet_provider : null;
  if (fromPayload) return fromPayload;
  if (row.origin === 'erp_gateway_withdrawal') return 'xendit';
  return row.expense?.gateway_wallet_provider ?? null;
}

/** Rows that affect ERP bank ledger (not gateway drawer mirrors). */
export function rowAffectsErpLedger(row: BankStatementLineWithMatch): boolean {
  if (row.origin === 'erp_gateway_withdrawal') {
    return true;
  }
  const gateway = getGatewayProvider(row);
  if (gateway === 'brick' || gateway === 'xendit') return false;
  if (row.origin === 'erp_expense') {
    return Boolean(row.expense?.gateway_wallet_provider == null);
  }
  return row.origin === 'brick_sync' || row.origin === 'brick_va' || row.origin === 'brick_disbursement';
}

function compareLinesDesc(a: BankStatementLineWithMatch, b: BankStatementLineWithMatch): number {
  const ta = new Date(a.transaction_date).getTime();
  const tb = new Date(b.transaction_date).getTime();
  if (tb !== ta) return tb - ta;
  return b.id.localeCompare(a.id);
}

/**
 * Per-line ERP balance after each mutation (walk backward from current account balance).
 * Gateway drawer rows are excluded (null).
 */
export function computeMutationErpBalances(
  lines: BankStatementLineWithMatch[],
  currentBalanceByAccount: Map<string, number>,
): Map<string, number | null> {
  const result = new Map<string, number | null>();
  const byAccount = new Map<string, BankStatementLineWithMatch[]>();

  for (const row of lines) {
    if (!row.bank_account_id) {
      result.set(row.id, null);
      continue;
    }
    if (!rowAffectsErpLedger(row)) {
      result.set(row.id, null);
      continue;
    }
    const list = byAccount.get(row.bank_account_id) ?? [];
    list.push(row);
    byAccount.set(row.bank_account_id, list);
  }

  for (const [accountId, accountLines] of byAccount) {
    const sorted = [...accountLines].sort(compareLinesDesc);
    let running = currentBalanceByAccount.get(accountId) ?? 0;

    for (const row of sorted) {
      const amount = Number(row.amount) || 0;
      result.set(row.id, running);
      if (row.direction === 'credit') {
        running -= amount;
      } else {
        running += amount;
      }
    }
  }

  return result;
}
