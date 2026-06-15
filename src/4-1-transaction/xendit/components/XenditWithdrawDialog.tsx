import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { executeXenditGatewayWithdrawal } from "@/xendit/lib/xenditApi";
import type { XenditGatewayPayoutBank } from "@/xendit/types/xendit";

const MIN_NET_WITHDRAWAL = 10_000;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  usableBalance: number;
  platformFee: number;
  payoutBank: XenditGatewayPayoutBank | null | undefined;
  onSuccess?: () => void;
};

function parseAmountInput(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Math.floor(Number(digits)) : 0;
}

export function XenditWithdrawDialog({
  open,
  onOpenChange,
  organizationId,
  usableBalance,
  platformFee,
  payoutBank,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [amountInput, setAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const gross = parseAmountInput(amountInput);
  const net = Math.max(0, gross - platformFee);
  const minGross = MIN_NET_WITHDRAWAL + platformFee;

  const validationError = useMemo(() => {
    if (gross <= 0) return null;
    if (gross > usableBalance) {
      return t("xendit.finance.errorInsufficient", "Nominal melebihi saldo CASH tersedia");
    }
    if (net < MIN_NET_WITHDRAWAL) {
      return t(
        "xendit.finance.errorMinAfterFee",
        "Minimum penarikan Rp {{min}} setelah biaya platform (Rp {{fee}}).",
        { min: MIN_NET_WITHDRAWAL.toLocaleString("id-ID"), fee: platformFee.toLocaleString("id-ID") },
      );
    }
    return null;
  }, [gross, net, usableBalance, platformFee, t]);

  const canSubmit = gross > 0 && !validationError && !submitting;

  const handleWithdrawAll = () => {
    setAmountInput(String(Math.floor(usableBalance)));
  };

  const invalidateAfterWithdraw = () => {
    void queryClient.invalidateQueries({ queryKey: ["xendit-gateway-withdrawals", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["bank-account-balances", organizationId] });
    void queryClient.invalidateQueries({
      queryKey: ["gateway-withdrawal-bank-period-credits", organizationId],
    });
    void queryClient.invalidateQueries({ queryKey: ["bank-statement-lines", organizationId] });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await executeXenditGatewayWithdrawal(organizationId, gross);
      toast.success(
        t(
          "xendit.finance.withdrawSubmitted",
          "Penarikan dikirim — saldo CASH berkurang setelah diproses Xendit.",
        ),
      );
      setAmountInput("");
      invalidateAfterWithdraw();
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const bankLabel =
    payoutBank?.gateway_payout_bank_code?.trim() || payoutBank?.bank_name?.trim() || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("xendit.finance.withdrawModalTitle", "Tarik Dana")}</DialogTitle>
          <DialogDescription>
            {t(
              "xendit.finance.withdrawModalDesc",
              "Dana dikirim dari saldo CASH sub-account ke rekening payout. Biaya platform Synckerja dipotong dari nominal yang Anda masukkan.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border border-gray-200 bg-gray-50/60 p-3 text-xs">
            <span className="text-muted-foreground">{t("xendit.finance.withdrawDestination", "Tujuan")}: </span>
            <span className="font-medium text-gray-900">
              {bankLabel}
              {payoutBank?.account_number ? ` · ${payoutBank.account_number}` : ""}
              {payoutBank?.account_holder ? ` · ${payoutBank.account_holder}` : ""}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="xendit-withdraw-gross" className="text-xs">
              {t("xendit.finance.withdrawGrossLabel", "Nominal penarikan")}
            </Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="xendit-withdraw-gross"
                inputMode="numeric"
                placeholder={formatToRupiah(minGross)}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                disabled={submitting}
                className="flex-1 min-w-[140px]"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={submitting || usableBalance <= 0}
                onClick={handleWithdrawAll}
              >
                {t("xendit.finance.withdrawAll", "Tarik semua")}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("xendit.finance.withdrawAvailable", "Saldo CASH tersedia")}: {formatToRupiah(usableBalance)}
            </p>
          </div>

          <dl className="space-y-2 rounded-md border border-gray-200 p-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">
                {t("xendit.finance.platformFeeLabel", "Biaya platform Synckerja")}
              </dt>
              <dd className="font-medium tabular-nums">− {formatToRupiah(platformFee)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-gray-100 pt-2">
              <dt className="font-medium text-gray-900">
                {t("xendit.finance.netLabel", "Total bersih ke rekening")}
              </dt>
              <dd className="font-semibold tabular-nums text-gray-900">
                {gross > 0 ? formatToRupiah(net) : "—"}
              </dd>
            </div>
          </dl>

          <p className="text-[11px] text-muted-foreground">
            {t(
              "xendit.finance.xenditFeeInfo",
              "Estimasi biaya transfer Xendit Rp 2.500–4.500 (informasi, tidak mempengaruhi perhitungan di atas).",
            )}
          </p>

          {validationError ? (
            <p className="text-xs text-destructive">{validationError}</p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Batal")}
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={() => void handleSubmit()}>
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                {t("xendit.finance.withdrawSubmitting", "Memproses…")}
              </>
            ) : (
              t("xendit.finance.withdrawConfirm", "Proses Penarikan")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
