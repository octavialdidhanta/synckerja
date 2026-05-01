import { useEffect, useMemo, useRef } from 'react';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useIncomeTransactions } from '@/4-1-dashboard/hooks';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { IncomeTransactionWithRelations } from '@/4-1-dashboard/types';

export interface IncomeAllocationOptionalSectionProps {
  /** When unset, section is hidden. */
  bankAccountId: string | undefined;
  /** Expense or debt payment amount (cap for allocation default). */
  referenceAmount: number;
  /** yyyy-MM-dd; income on or before this date only. */
  referenceDate?: string;
  selectedIncomeId: string;
  onSelectedIncomeId: (id: string) => void;
  allocationAmountStr: string;
  onAllocationAmountStrChange: (value: string) => void;
}

function remainingFor(tx: IncomeTransactionWithRelations): number {
  const gross = Number(tx.amount ?? 0);
  return gross - (tx.allocated_amount ?? 0);
}

function compareTxDateDesc(a: IncomeTransactionWithRelations, b: IncomeTransactionWithRelations): number {
  const da = typeof a.transaction_date === 'string' ? a.transaction_date.slice(0, 10) : '';
  const db = typeof b.transaction_date === 'string' ? b.transaction_date.slice(0, 10) : '';
  return db.localeCompare(da);
}

/**
 * Single candidate: pick immediately (full remaining if payment amount not entered yet; else min(ref, rem)).
 * Multiple + payment amount: newest that covers ref, else largest remaining.
 * Multiple + no payment amount yet: newest eligible income (user can adjust allocation field).
 */
function pickAutoAllocation(
  candidates: IncomeTransactionWithRelations[],
  referenceAmount: number
): { id: string; amount: number } | null {
  if (candidates.length === 0) return null;
  const ref = referenceAmount > 1e-6 ? referenceAmount : 0;
  const sortedNewestFirst = [...candidates].sort(compareTxDateDesc);

  if (sortedNewestFirst.length === 1) {
    const tx = sortedNewestFirst[0];
    const rem = remainingFor(tx);
    const cap = ref > 1e-6 ? Math.min(ref, rem) : rem;
    if (!(cap > 1e-6)) return null;
    return { id: tx.id, amount: Math.round(cap * 100) / 100 };
  }

  if (ref > 1e-6) {
    const covers = sortedNewestFirst.find((tx) => remainingFor(tx) >= ref - 1e-6);
    if (covers) {
      return { id: covers.id, amount: Math.round(ref * 100) / 100 };
    }
    const scored = sortedNewestFirst.map((tx) => ({ tx, rem: remainingFor(tx) }));
    scored.sort((a, b) => {
      if (Math.abs(b.rem - a.rem) > 1e-6) return b.rem - a.rem;
      return compareTxDateDesc(a.tx, b.tx);
    });
    const best = scored[0];
    if (!(best.rem > 1e-6)) return null;
    const cap = Math.min(ref, best.rem);
    return { id: best.tx.id, amount: Math.round(cap * 100) / 100 };
  }

  const newest = sortedNewestFirst[0];
  const rem = remainingFor(newest);
  if (!(rem > 1e-6)) return null;
  return { id: newest.id, amount: Math.round(rem * 100) / 100 };
}

/**
 * Optional link from a bank-funded payment/expense to an income row on the same account.
 * Auto-picks when possible; user can choose None or adjust selection/amount.
 */
export function IncomeAllocationOptionalSection({
  bankAccountId,
  referenceAmount,
  referenceDate,
  selectedIncomeId,
  onSelectedIncomeId,
  allocationAmountStr,
  onAllocationAmountStrChange,
}: IncomeAllocationOptionalSectionProps) {
  const { t } = useAppTranslation();
  const { incomeTransactions, isLoading } = useIncomeTransactions();

  const onSelectedIncomeIdRef = useRef(onSelectedIncomeId);
  const onAllocationAmountStrChangeRef = useRef(onAllocationAmountStrChange);
  onSelectedIncomeIdRef.current = onSelectedIncomeId;
  onAllocationAmountStrChangeRef.current = onAllocationAmountStrChange;

  /** User explicitly chose "None"; do not auto-pick until bank or reference date changes. */
  const userDeclinedAutoRef = useRef(false);
  const prevBankRef = useRef<string | undefined>(bankAccountId);
  const prevDateRef = useRef<string | undefined>(referenceDate);

  const candidates = useMemo(() => {
    const bid = bankAccountId?.trim();
    if (!bid) return [];
    const refD = referenceDate?.trim().slice(0, 10) ?? '';
    return incomeTransactions.filter((tx) => {
      if (tx.bank_account_id !== bid) return false;
      if (tx.is_legacy_bank_transfer_income) return false;
      if (tx.status !== 'completed' && tx.status !== 'pending') return false;
      const allocated = tx.allocated_amount ?? 0;
      const gross = Number(tx.amount ?? 0);
      const remaining = gross - allocated;
      if (!(remaining > 1e-6)) return false;
      if (refD && typeof tx.transaction_date === 'string' && tx.transaction_date.slice(0, 10) > refD) {
        return false;
      }
      return true;
    }) as IncomeTransactionWithRelations[];
  }, [bankAccountId, incomeTransactions, referenceDate]);

  useEffect(() => {
    const bank = bankAccountId?.trim();
    const dateKey = referenceDate?.trim().slice(0, 10) ?? '';
    const prevBank = prevBankRef.current?.trim();
    const prevDate = prevDateRef.current?.trim().slice(0, 10) ?? '';
    if (bank !== prevBank || dateKey !== prevDate) {
      userDeclinedAutoRef.current = false;
      prevBankRef.current = bankAccountId;
      prevDateRef.current = referenceDate;
    }
  }, [bankAccountId, referenceDate]);

  useEffect(() => {
    if (isLoading || !bankAccountId?.trim()) return;

    const setId = onSelectedIncomeIdRef.current;
    const setAmt = onAllocationAmountStrChangeRef.current;

    if (candidates.length === 0) {
      if (selectedIncomeId) {
        setId('');
        setAmt('');
      }
      return;
    }

    if (selectedIncomeId) {
      const tx = candidates.find((x) => x.id === selectedIncomeId);
      if (tx && remainingFor(tx) > 1e-6) {
        return;
      }
      setId('');
      setAmt('');
      if (userDeclinedAutoRef.current) {
        return;
      }
    }

    if (userDeclinedAutoRef.current) {
      return;
    }

    const pick = pickAutoAllocation(candidates, referenceAmount);
    if (!pick) return;
    setId(pick.id);
    setAmt(String(pick.amount));
  }, [isLoading, bankAccountId, candidates, referenceAmount, selectedIncomeId]);

  if (!bankAccountId?.trim()) {
    return null;
  }

  return (
    <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-3 space-y-2">
      <p className="text-sm font-medium leading-snug">
        {t('incomes.allocation.sectionTitle', 'Link to income (optional)')}
      </p>
      <p className="text-xs text-muted-foreground leading-snug">
        {t(
          'incomes.allocation.sectionHint',
          'Choose income on this same account if needed. Usually filled automatically; pick None to skip.'
        )}
      </p>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">{t('common.loading', 'Loading…')}</p>
      ) : candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t(
            'incomes.allocation.noEligibleIncome',
            'No eligible income on this account with remaining balance to allocate.'
          )}
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="income-allocation-select" className="text-xs">
              {t('incomes.allocation.selectIncome', 'Income')}
            </Label>
            <Select
              value={selectedIncomeId || '__none__'}
              onValueChange={(v) => {
                if (v === '__none__') {
                  userDeclinedAutoRef.current = true;
                  onSelectedIncomeId('');
                  onAllocationAmountStrChange('');
                  return;
                }
                userDeclinedAutoRef.current = false;
                onSelectedIncomeId(v);
                const tx = candidates.find((x) => x.id === v);
                if (tx) {
                  const rem = remainingFor(tx);
                  const cap = Math.min(referenceAmount > 0 ? referenceAmount : rem, rem);
                  if (cap > 0) {
                    onAllocationAmountStrChange(String(Math.round(cap * 100) / 100));
                  }
                }
              }}
            >
              <SelectTrigger id="income-allocation-select" className="h-9 text-sm">
                <SelectValue placeholder={t('incomes.allocation.placeholder', 'None')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t('incomes.allocation.none', 'None')}</SelectItem>
                {candidates.map((tx) => {
                  const rem = remainingFor(tx);
                  const label =
                    (tx.customer_name || tx.description || 'Income').slice(0, 48) +
                    ` · ${formatToRupiah(rem)} ${t('incomes.allocation.remaining', 'left')}`;
                  return (
                    <SelectItem key={tx.id} value={tx.id}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          {selectedIncomeId ? (
            <div className="space-y-1.5">
              <Label htmlFor="income-allocation-amount" className="text-xs">
                {t('incomes.allocation.amountLabel', 'Amount (IDR)')}
              </Label>
              <Input
                id="income-allocation-amount"
                className="h-9 text-sm"
                inputMode="decimal"
                value={allocationAmountStr}
                onChange={(e) => onAllocationAmountStrChange(e.target.value)}
                placeholder="0"
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
