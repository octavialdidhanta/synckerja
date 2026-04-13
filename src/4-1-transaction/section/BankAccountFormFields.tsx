import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { BankAccountFormData } from "@/4-1-transaction/hooks/useBankAccountManagementModel";

type Props = {
  twoColumn?: boolean;
  formData: BankAccountFormData;
  setFormData: React.Dispatch<React.SetStateAction<BankAccountFormData>>;
  idPrefix: string;
  inputClassName?: string;
};

export function BankAccountFormFields({
  twoColumn,
  formData,
  setFormData,
  idPrefix,
  inputClassName = "",
}: Props) {
  const { t } = useAppTranslation();
  const gridClass = twoColumn ? "grid grid-cols-2 gap-3" : "space-y-3";

  return (
    <div className={gridClass}>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`} className="text-xs">
          {t("incomes.bankAccountForm.accountName", "Account name")} *
        </Label>
        <Input
          id={`${idPrefix}-name`}
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={t("incomes.bankAccountForm.accountNamePlaceholder", "Enter account name")}
          required
          className={inputClassName}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-bank_name`} className="text-xs">
          {t("incomes.bankAccountForm.bankName", "Bank name")}
        </Label>
        <Input
          id={`${idPrefix}-bank_name`}
          value={formData.bank_name}
          onChange={(e) => setFormData((prev) => ({ ...prev, bank_name: e.target.value }))}
          placeholder={t("incomes.bankAccountForm.bankNamePlaceholder", "Enter bank name")}
          className={inputClassName}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-account_number`} className="text-xs">
          {t("incomes.bankAccountForm.accountNumber", "Account number")}
        </Label>
        <Input
          id={`${idPrefix}-account_number`}
          value={formData.account_number}
          onChange={(e) => setFormData((prev) => ({ ...prev, account_number: e.target.value }))}
          placeholder={t("incomes.bankAccountForm.accountNumberPlaceholder", "Enter account number")}
          className={inputClassName}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-account_holder`} className="text-xs">
          {t("incomes.bankAccountForm.accountHolder", "Account holder")}
        </Label>
        <Input
          id={`${idPrefix}-account_holder`}
          value={formData.account_holder}
          onChange={(e) => setFormData((prev) => ({ ...prev, account_holder: e.target.value }))}
          placeholder={t("incomes.bankAccountForm.accountHolderPlaceholder", "Enter account holder name")}
          className={inputClassName}
        />
      </div>
    </div>
  );
}
