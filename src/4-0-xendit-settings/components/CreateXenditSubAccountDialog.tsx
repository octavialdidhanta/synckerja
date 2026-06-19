import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
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
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import {
  getSubAccountEmailErrorMessage,
  isSubAccountEmailTaken,
} from "@/xendit/lib/subAccountEmailUtils";
import {
  isValidEmailAddress,
  mapBankNameToXenditCode,
  XENDIT_DISBURSEMENT_BANKS,
} from "@/xendit/lib/bankCodes";
import {
  FormFieldLabel,
  FormInfoHint,
} from "@/shared/components/FormInfoHint";

type CreateXenditSubAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountType: "OWNED" | "MANAGED";
  defaultBusinessName?: string;
  defaultEmail?: string;
};

const NONE_BANK = "__none__";

export function CreateXenditSubAccountDialog({
  open,
  onOpenChange,
  accountType,
  defaultBusinessName = "",
  defaultEmail = "",
}: CreateXenditSubAccountDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { data: xenditSettings } = useXenditOrgSettings(organizationId);
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
    setBusinessName(defaultBusinessName);
    setEmail(defaultEmail && isValidEmailAddress(defaultEmail) ? defaultEmail : "");
    setLinkedBankAccountId(NONE_BANK);
    setBankCode("");
    setAccountNumber("");
    setAccountHolder("");
  }, [open, defaultBusinessName, defaultEmail]);

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
      toast.error(t("xendit.subAccountDrawerLabelRequired", "Nama akun wajib diisi"));
      return;
    }
    if (!isValidEmailAddress(trimmedEmail)) {
      toast.error(t("xendit.subAccountEmailInvalid", "Masukkan alamat email yang valid"));
      return;
    }
    if (isSubAccountEmailTaken(trimmedEmail, xenditSettings?.subAccounts)) {
      toast.error(
        t("xendit.subAccountEmailAlreadyExists", "Email sudah terdaftar untuk bisnis ini"),
      );
      return;
    }
    if (!trimmedBank || !trimmedNumber || !trimmedHolder) {
      toast.error(
        t(
          "xendit.subAccountBankRequired",
          "Pilih rekening bank atau isi kode bank, nomor rekening, dan nama pemilik",
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
        type: accountType,
        linkedBankAccountId:
          linkedBankAccountId !== NONE_BANK ? linkedBankAccountId : null,
        payoutBankCode: trimmedBank,
        payoutAccountNumber: trimmedNumber,
        payoutAccountHolderName: trimmedHolder,
      });
      toast.success(t("xendit.subAccountCreated", "Akun berhasil dibuat"));
      void queryClient.invalidateQueries({ queryKey: ["xendit-settings", organizationId] });
      void queryClient.invalidateQueries({ queryKey: ["bank-accounts", organizationId] });
      onOpenChange(false);
    } catch (err) {
      toast.error(getSubAccountEmailErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("xendit.createSubAccountTitle", "Sub-account Xendit baru")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div className="space-y-1.5">
            <FormFieldLabel
              htmlFor="xendit-business-name"
              label={t("xendit.subAccountNameShort", "Nama akun")}
              info={t(
                "xendit.subAccountDrawerLabelHint",
                "Nama ini muncul di daftar sub-account Xendit. Contoh: Gaji operasional, Escrow PPh21 & BPJS, atau Penjualan online.",
              )}
              infoAriaLabel={t("xendit.subAccountNameShort", "Nama akun")}
            />
            <Input
              id="xendit-business-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t(
                "xendit.subAccountDrawerLabelPlaceholder",
                "Escrow PPh21 & BPJS",
              )}
              required
              autoComplete="off"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <FormFieldLabel
              htmlFor="xendit-email"
              label={t("xendit.subAccountEmailShort", "Email")}
              info={t(
                "xendit.subAccountEmailHint",
                "Satu email = satu sub-account per organisasi. Harus email valid yang diterima Xendit (bukan alamat placeholder).",
              )}
              infoAriaLabel={t("xendit.subAccountEmailShort", "Email")}
            />
            <Input
              id="xendit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="finance@company.com"
              required
              autoComplete="email"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <FormFieldLabel
              label={t("xendit.linkErpBankAccountShort", "Rekening Keuangan")}
              info={t(
                "xendit.linkErpBankAccountHint",
                "Opsional. Pilih rekening dari menu Keuangan agar kolom bank di bawah terisi otomatis.",
              )}
              infoAriaLabel={t("xendit.linkErpBankAccountShort", "Rekening Keuangan")}
            />
            <Select
              value={linkedBankAccountId}
              onValueChange={applyBankAccount}
              disabled={banksLoading || activeBanks.length === 0}
            >
              <SelectTrigger className="h-9">
                <SelectValue
                  placeholder={
                    banksLoading
                      ? t("common.loading", "Memuat…")
                      : t("xendit.manualBankEntry", "Isi manual")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_BANK}>
                  {t("xendit.manualBankEntry", "Isi manual")}
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
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-sm font-medium">{t("xendit.bank", "Bank")}</Label>
                <FormInfoHint
                  ariaLabel={t("xendit.payoutBankInfo", "Validasi rekening")}
                  content={t(
                    "xendit.payoutValidation.createHint",
                    "Rekening payout divalidasi ke bank (Iluma) sebelum akun dibuat. Hanya hasil MATCH yang diterima.",
                  )}
                />
              </div>
              <Select value={bankCode || undefined} onValueChange={setBankCode}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t("xendit.selectBank", "Pilih bank")} />
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

            <div className="space-y-1.5">
              <Label htmlFor="xendit-account-number" className="text-sm font-medium">
                {t("xendit.accountNumber", "Nomor rekening")}
              </Label>
              <Input
                id="xendit-account-number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                inputMode="numeric"
                required
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="xendit-account-holder" className="text-sm font-medium">
                {t("xendit.accountHolder", "Nama pemilik")}
              </Label>
              <Input
                id="xendit-account-holder"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                required
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-1 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t("common.cancel", "Batal")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? t("xendit.processing", "Memproses…")
                : t("xendit.createSubAccount", "Daftarkan")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
