import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import { useSecureXenditActions } from "@/xendit/hooks/useSecureXenditActions";

type Props = {
  debtPaymentId: string;
  amount: number;
  description?: string;
  onSuccess?: () => void;
};

export function DebtXenditDisburseButton({ debtPaymentId, amount, description, onSuccess }: Props) {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const { data: settings } = useXenditOrgSettings(organizationId);
  const { secureDisbursement } = useSecureXenditActions();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bankCode, setBankCode] = useState("BCA");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  if (!settings?.account?.is_enabled) return null;

  const handlePay = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      await secureDisbursement(organizationId, {
        source_type: "debt_payment",
        source_id: debtPaymentId,
        bank_code: bankCode,
        account_number: accountNumber,
        account_holder_name: accountHolder,
        amount,
        description: description ?? "Debt payment",
      });
      toast.success(t("xendit.debtDisburseStarted", "Debt disbursement submitted"));
      setOpen(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {t("xendit.disburseDebt", "Disburse via Xendit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("xendit.debtDisburseTitle", "Debt payment via Xendit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("xendit.bank", "Bank")}</Label>
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(settings?.vaBanks ?? []).map((b) => (
                    <SelectItem key={b.code} value={b.code}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("xendit.accountNumber", "Account number")}</Label>
              <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div>
              <Label>{t("xendit.accountHolder", "Account holder")}</Label>
              <Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handlePay} disabled={loading || !accountNumber || !accountHolder}>
              {loading ? t("xendit.processing", "Processing…") : t("xendit.submit", "Submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
