import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useBankAccounts } from "@/shared/hooks/finance/useBankAccounts";
import { createXenditSubAccount } from "@/xendit/lib/xenditApi";
import {
  isValidEmailAddress,
  mapBankNameToXenditCode,
  XENDIT_DISBURSEMENT_BANKS,
} from "@/xendit/lib/bankCodes";
import type { XenditOrgAccount } from "@/xendit/types/xendit";

type CreateXenditSubAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: XenditOrgAccount | null | undefined;
};

const NONE_BANK = "__none__";

export function CreateXenditSubAccountDialog({
  open,
  onOpenChange,
  account,
}: CreateXenditSubAccountDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { bankAccounts = [], loading: banksLoading } = useBankAccounts();

  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedBankAccountId, setLinkedBankAccountId] = useState<string>(NONE_BANK);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeBanks = useMemo(
    () => bankAccounts.filter((b) => b.is_active),
    [bankAccounts],
  );

  useEffect(() => {
    if (!open) return;
    const seedEmail =
      account?.email && isValidEmailAddress(account.email) ? account.email : "";
    setBusinessName(account?.business_name?.trim() ?? "");
    setEmail(seedEmail);
    setLinkedBankAccountId(NONE_BANK);
    setBankCode("");
    setAccountNumber("");
    setAccountHolder("");
  }, [open, account?.business_name, account?.email]);

  const applyBankAccount = (bankAccountId: string) => {
    setLinkedBankAccountId(bankAccountId);
    if (bankAccountId === NONE_BANK) return;
    const row = activeBanks.find((b) => b.id === bankAccountId);
    if (!row) return;
    if (row.bank_name) setBankCode(mapBankNameToXenditCode(row.bank_name));
    if (row.account_number) setAccountNumber(row.account_number);
    if (row.account_holder) setAccountHolder(row.account_holder);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    const trimmedName = businessName.trim();
    const trimmedEmail = email.trim();
    const trimmedNumber = accountNumber.trim();
    const trimmedHolder = accountHolder.trim();
    const trimmedBank = bankCode.trim();

    if (!trimmedName) {
      toast.error(t("xendit.subAccountBusinessNameRequired", "Business name is required"));
      return;
    }
    if (!isValidEmailAddress(trimmedEmail)) {
      toast.error(t("xendit.subAccountEmailInvalid", "Enter a valid email address"));
      return;
    }
    if (!trimmedBank || !trimmedNumber || !trimmedHolder) {
      toast.error(
        t(
          "xendit.subAccountBankRequired",
          "Select a bank account or fill in bank code, account number, and holder name",
        ),
      );
      return;
    }

    setSubmitting(true);
    try {
      await createXenditSubAccount({
        organizationId,
        businessName: trimmedName,
        email: trimmedEmail.toLowerCase(),
        type: "OWNED",
        linkedBankAccountId:
          linkedBankAccountId !== NONE_BANK ? linkedBankAccountId : null,
        payoutBankCode: trimmedBank,
        payoutAccountNumber: trimmedNumber,
        payoutAccountHolderName: trimmedHolder,
      });
      toast.success(t("xendit.subAccountCreated", "Sub-account created"));
      void queryClient.invalidateQueries({ queryKey: ["xendit-settings", organizationId] });
      void queryClient.invalidateQueries({ queryKey: ["bank-accounts", organizationId] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("xendit.createSubAccountTitle", "Create Xendit sub-account")}</DialogTitle>
          <DialogDescription>
            {t(
              "xendit.createSubAccountDesc",
              "Register your xenPlatform drawer with Xendit. Use a real business email and the bank account used for withdrawals and disbursements.",
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="xendit-business-name">
              {t("xendit.subAccountBusinessName", "Business name")}
            </Label>
            <Input
              id="xendit-business-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t("xendit.subAccountBusinessNamePlaceholder", "PT Contoh Indonesia")}
              required
              autoComplete="organization"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="xendit-email">{t("xendit.subAccountEmail", "Business email")}</Label>
            <Input
              id="xendit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="finance@company.com"
              required
              autoComplete="email"
            />
            <p className="text-[11px] text-muted-foreground">
              {t(
                "xendit.subAccountEmailHint",
                "Must be a valid email accepted by Xendit (not a placeholder address).",
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t("xendit.linkErpBankAccount", "Link ERP bank account")}</Label>
            <Select
              value={linkedBankAccountId}
              onValueChange={applyBankAccount}
              disabled={banksLoading || activeBanks.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    banksLoading
                      ? t("common.loading", "Loading…")
                      : t("xendit.selectBankAccount", "Select bank account (optional)")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_BANK}>
                  {t("xendit.manualBankEntry", "Enter bank details manually")}
                </SelectItem>
                {activeBanks.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.name}
                    {bank.bank_name ? ` · ${bank.bank_name}` : ""}
                    {bank.account_number ? ` · ${bank.account_number}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("xendit.bank", "Bank")}</Label>
              <Select value={bankCode || undefined} onValueChange={setBankCode}>
                <SelectTrigger>
                  <SelectValue placeholder={t("xendit.selectBank", "Select bank")} />
                </SelectTrigger>
                <SelectContent>
                  {XENDIT_DISBURSEMENT_BANKS.map((bank) => (
                    <SelectItem key={bank.code} value={bank.code}>
                      {bank.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="xendit-account-number">
                {t("xendit.accountNumber", "Account number")}
              </Label>
              <Input
                id="xendit-account-number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                inputMode="numeric"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="xendit-account-holder">
                {t("xendit.accountHolder", "Account holder")}
              </Label>
              <Input
                id="xendit-account-holder"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                required
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {t(
              "xendit.payoutValidation.createHint",
              "Rekening payout akan divalidasi ke bank (Iluma) sebelum sub-account dibuat. Hanya hasil MATCH yang diterima.",
            )}
          </p>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? t("xendit.processing", "Processing…")
                : t("xendit.createSubAccount", "Create sub-account")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
