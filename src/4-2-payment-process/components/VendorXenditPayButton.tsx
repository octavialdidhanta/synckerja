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
import { executeXenditDisbursement } from "@/xendit/lib/xenditApi";
import type { PurchaseRequest } from "@/9-request-form/hooks/usePurchaseRequests";

type Props = {
  request: PurchaseRequest;
  onSuccess?: () => void;
};

export function VendorXenditPayButton({ request, onSuccess }: Props) {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const { data: settings } = useXenditOrgSettings(organizationId);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bankCode, setBankCode] = useState(request.vendor_bank_code ?? "BCA");
  const [accountNumber, setAccountNumber] = useState(request.vendor_bank_account_number ?? "");
  const [accountHolder, setAccountHolder] = useState(request.vendor_bank_account_holder ?? "");

  if (!settings?.account?.is_enabled || request.status !== "approved" || request.paid_at) return null;

  const handlePay = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      await executeXenditDisbursement(organizationId, {
        source_type: "purchase_request",
        source_id: request.id,
        bank_code: bankCode,
        account_number: accountNumber,
        account_holder_name: accountHolder,
        amount: request.amount_idr,
        description: `Vendor payment ${request.request_title ?? request.id}`,
      });
      toast.success(t("xendit.vendorDisburseStarted", "Vendor payment submitted"));
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
        {t("xendit.payVendor", "Pay via Xendit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("xendit.vendorDisburseTitle", "Vendor disbursement")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("xendit.bank", "Bank")}</Label>
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(settings.vaBanks ?? []).map((b) => (
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
