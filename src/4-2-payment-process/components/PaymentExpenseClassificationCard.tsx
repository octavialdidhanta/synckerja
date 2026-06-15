import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { WithdrawalFromBalanceSelect } from '@/shared/components/finance/WithdrawalFromBalanceSelect';
import { useExpenseTypes } from '@/shared/hooks/finance/useExpenseTypes';
import { useExpenseCategories } from '@/shared/hooks/finance/useExpenseCategories';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { WithdrawalSourceValue } from '@/shared/lib/finance/withdrawalSourceValue';

type PaymentExpenseClassificationCardProps = {
  expenseTypeId: string;
  expenseCategoryId: string;
  withdrawalSource: WithdrawalSourceValue;
  onExpenseTypeChange: (id: string) => void;
  onExpenseCategoryChange: (id: string) => void;
  onWithdrawalSourceChange: (value: WithdrawalSourceValue) => void;
};

export function PaymentExpenseClassificationCard({
  expenseTypeId,
  expenseCategoryId,
  withdrawalSource,
  onExpenseTypeChange,
  onExpenseCategoryChange,
  onWithdrawalSourceChange,
}: PaymentExpenseClassificationCardProps) {
  const { t } = useAppTranslation();
  const { expenseTypes } = useExpenseTypes();
  const { expenseCategories } = useExpenseCategories(expenseTypeId);
  const prevExpenseTypeIdRef = useRef<string | undefined>(expenseTypeId || undefined);

  useEffect(() => {
    const prev = prevExpenseTypeIdRef.current;
    if (prev !== undefined && prev !== expenseTypeId) {
      onExpenseCategoryChange('');
    }
    prevExpenseTypeIdRef.current = expenseTypeId;
  }, [expenseTypeId, onExpenseCategoryChange]);

  return (
    <Card className="border-slate-200">
      <CardHeader className="px-4 py-3 pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {t('expenses.expenseClassification', 'Expense Classification')}
        </CardTitle>
        <p className="text-xs font-normal text-slate-500 mt-1">
          {t(
            'payments.expenseClassificationHint',
            'Select expense type, category, and funding source before processing payment.',
          )}
        </p>
      </CardHeader>
      <CardContent className="px-4 py-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="payment-expense-type" className="text-sm font-medium">
              {t('expenses.expenseType', 'Expense Type')}{' '}
              <span className="text-brand-red">*</span>
            </Label>
            <Select value={expenseTypeId || undefined} onValueChange={onExpenseTypeChange}>
              <SelectTrigger id="payment-expense-type">
                <SelectValue placeholder={t('expenses.selectExpenseType', 'Select expense type')} />
              </SelectTrigger>
              <SelectContent>
                {expenseTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {expenseTypeId ? (
            <div className="space-y-2">
              <Label htmlFor="payment-expense-category" className="text-sm font-medium">
                {t('expenses.expenseCategory', 'Expense Category')}{' '}
                <span className="text-brand-red">*</span>
              </Label>
              <Select value={expenseCategoryId || undefined} onValueChange={onExpenseCategoryChange}>
                <SelectTrigger id="payment-expense-category">
                  <SelectValue placeholder={t('expenses.selectExpenseCategory', 'Select expense category')} />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.length > 0 ? (
                    expenseCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-categories" disabled>
                      {t('expenses.noCategoriesAvailable', 'No categories available')}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <WithdrawalFromBalanceSelect
          id="process-withdrawal"
          value={withdrawalSource}
          onChange={onWithdrawalSourceChange}
          allowNone={false}
          requiredMark
          showLabel
          label={t('expenses.withdrawalFromBalanceRequired', 'Withdrawal From Balance')}
          placeholder={t('expenses.selectSourceRequired', 'Select source (required)')}
        />
      </CardContent>
    </Card>
  );
}
