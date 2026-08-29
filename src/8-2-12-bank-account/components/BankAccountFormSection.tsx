import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { BankNameSelect } from "./BankNameSelect";

type Props = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  onBankNameChange: (v: string) => void;
  onAccountNumberChange: (v: string) => void;
  onAccountHolderChange: (v: string) => void;
  disabled?: boolean;
};

export function BankAccountFormSection({
  bankName,
  accountNumber,
  accountHolder,
  onBankNameChange,
  onAccountNumberChange,
  onAccountHolderChange,
  disabled,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <section className="rounded-md border border-border bg-white p-4">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t(
            "settings.bankAccount.infoSection",
            "Bank Account Information",
          )}
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("settings.bankAccount.bankName", "Bank Name")}
          </Label>
          <BankNameSelect
            value={bankName}
            onChange={onBankNameChange}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("settings.bankAccount.accountNumber", "Account Number")}
          </Label>
          <Input
            value={accountNumber}
            onChange={(e) => onAccountNumberChange(e.target.value)}
            placeholder={t(
              "settings.bankAccount.accountNumberPlaceholder",
              "Account Number",
            )}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("settings.bankAccount.accountHolder", "Account Holder")}
          </Label>
          <Input
            value={accountHolder}
            onChange={(e) => onAccountHolderChange(e.target.value)}
            placeholder={t(
              "settings.bankAccount.accountHolderPlaceholder",
              "Full Name",
            )}
            disabled={disabled}
            autoComplete="name"
          />
        </div>
      </div>
    </section>
  );
}
