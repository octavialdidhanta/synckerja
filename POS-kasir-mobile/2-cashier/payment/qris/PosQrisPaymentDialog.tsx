import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import { usePosQrisPayment, usePosQrisStatus } from "@/shared/pos-qris";
import { mapPosQrisErrorKey } from "@/shared/pos-qris/lib/posQrisErrors";
import type { BuildPendingCheckoutPayloadArgs } from "@/shared/pos-qris/lib/buildPendingCheckoutPayload";
import { useToast } from "@/shared/hooks/use-toast";
import { PosPrinterUnavailableError } from "@/pos-mobile/shared/printing/PosPrinterBridge";
import { POS_SETTINGS_I18N } from "@/pos-mobile/3-settings/lib/posSettingsCopy";
import { PosQrisQrImage } from "./lib/PosQrisQrImage";
import { POS_QRIS_TTL_SECONDS } from "./lib/posQrisConstants";
import { printPosQrisFromDialog } from "./lib/printPosQris";
import { PosQrisHeader } from "./components/PosQrisHeader";
import { PosQrisAmount } from "./components/PosQrisAmount";
import { PosQrisCountdownRing } from "./components/PosQrisCountdownRing";
import { PosQrisMerchantInfo } from "./components/PosQrisMerchantInfo";
import { cn } from "@/shared/lib/utils";

export type PosQrisPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  outletId: string;
  outletName?: string | null;
  outletAddress?: string | null;
  amountDue: number;
  isSandbox?: boolean;
  checkout: BuildPendingCheckoutPayloadArgs;
  onPaid: (args: { salesActivityId: string | null; pendingCheckoutId: string }) => void;
  onCancel?: () => void;
};

function remainingSecondsFrom(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function PosQrisPaymentDialog({
  open,
  onOpenChange,
  organizationId,
  outletId,
  outletName,
  outletAddress,
  amountDue,
  isSandbox,
  checkout,
  onPaid,
  onCancel,
}: PosQrisPaymentDialogProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { createQrisPayment, cancelQrisPayment, simulateQrisPayment, isCreating, isCancelling, isSimulating } =
    usePosQrisPayment();
  const [paymentRequestId, setPaymentRequestId] = useState<string | null>(null);
  const [pendingCheckoutId, setPendingCheckoutId] = useState<string | null>(null);
  const [qrString, setQrString] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(POS_QRIS_TTL_SECONDS);
  const [printing, setPrinting] = useState(false);
  const [localExpired, setLocalExpired] = useState(false);

  const { status, isPaid, isTerminal, salesActivityId } = usePosQrisStatus(
    paymentRequestId,
    open && Boolean(paymentRequestId),
  );

  const startPayment = useCallback(async () => {
    setErrorKey(null);
    setLocalExpired(false);
    try {
      const result = await createQrisPayment({
        organizationId,
        outletId,
        checkout,
      });
      setPendingCheckoutId(result.pending_checkout_id);
      setPaymentRequestId(result.payment_request.id);
      setQrString(result.payment_request.qr_string);
      setExpiresAt(result.expires_at || result.payment_request.expires_at);
    } catch (err) {
      setErrorKey(mapPosQrisErrorKey(err));
    }
  }, [createQrisPayment, organizationId, outletId, checkout]);

  const handleSimulate = useCallback(async () => {
    if (!isSandbox || !paymentRequestId) return;
    setErrorKey(null);
    try {
      await simulateQrisPayment({
        organizationId,
        paymentRequestId,
        pendingCheckoutId: pendingCheckoutId ?? undefined,
      });
    } catch (err) {
      setErrorKey(mapPosQrisErrorKey(err));
    }
  }, [
    isSandbox,
    paymentRequestId,
    pendingCheckoutId,
    organizationId,
    simulateQrisPayment,
  ]);

  useEffect(() => {
    if (!open) {
      setPaymentRequestId(null);
      setPendingCheckoutId(null);
      setQrString(null);
      setExpiresAt(null);
      setErrorKey(null);
      setLocalExpired(false);
      setRemainingSeconds(POS_QRIS_TTL_SECONDS);
      return;
    }
    void startPayment();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- start once per open

  const expireHandledRef = useRef(false);

  useEffect(() => {
    if (!open) {
      expireHandledRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !expiresAt || isPaid) return;
    const tick = () => {
      const next = remainingSecondsFrom(expiresAt);
      setRemainingSeconds(next);
      if (next <= 0 && !expireHandledRef.current && !isPaid) {
        expireHandledRef.current = true;
        setLocalExpired(true);
        if (pendingCheckoutId) {
          void cancelQrisPayment({
            organizationId,
            pendingCheckoutId,
            reason: "expired",
          }).catch(() => undefined);
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [open, expiresAt, isPaid, pendingCheckoutId, organizationId, cancelQrisPayment]);

  const paidHandledRef = useRef(false);

  useEffect(() => {
    if (!open) {
      paidHandledRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!isPaid || !pendingCheckoutId || paidHandledRef.current) return;
    paidHandledRef.current = true;
    onPaid({ salesActivityId, pendingCheckoutId });
  }, [isPaid, salesActivityId, pendingCheckoutId, onPaid]);

  useEffect(() => {
    if (!open || !isTerminal || isPaid || localExpired) return;
    if (pendingCheckoutId) {
      void cancelQrisPayment({
        organizationId,
        pendingCheckoutId,
        reason: status === "failed" ? "failed" : "expired",
      }).catch(() => undefined);
    }
  }, [open, isTerminal, isPaid, localExpired, pendingCheckoutId, organizationId, cancelQrisPayment, status]);

  const isExpiredUi = localExpired || status === "expired";

  const statusLabel = useMemo(() => {
    if (isCreating) return t("pos.payment.qris.creating", "Creating QR…");
    if (errorKey) return t(errorKey, "QRIS payment failed");
    if (isPaid) return t("pos.payment.qris.paid", "Payment received");
    if (isExpiredUi) return t("pos.payment.qris.expired", "QR expired");
    if (status === "failed") return t("pos.payment.qris.failed", "Payment failed");
    return null;
  }, [isCreating, errorKey, isPaid, isExpiredUi, status, t]);

  const handleCancel = () => {
    if (pendingCheckoutId && !isPaid && !isExpiredUi) {
      void cancelQrisPayment({
        organizationId,
        pendingCheckoutId,
        reason: "cancelled",
      }).finally(() => {
        onCancel?.();
        onOpenChange(false);
      });
      return;
    }
    onCancel?.();
    onOpenChange(false);
  };

  const handlePrint = async () => {
    if (!qrString || isPaid || isExpiredUi || errorKey) return;
    setPrinting(true);
    try {
      await printPosQrisFromDialog({
        outletId,
        outletName: outletName?.trim() || outletId,
        outletAddress,
        amountLabel: formatStoreCheckoutRp(amountDue),
        qrString,
      });
      toast({
        title: t("pos.payment.qris.printSuccess", "QR code printed"),
      });
    } catch (err) {
      if (err instanceof PosPrinterUnavailableError) {
        toast({
          title: t(
            POS_SETTINGS_I18N.printerBluetoothUnavailable,
            "Bluetooth printers are only available in the Synckerja Android app.",
          ),
          variant: "destructive",
        });
      } else if (err instanceof Error && err.message === "no_receipt_printer") {
        toast({
          title: t(POS_SETTINGS_I18N.printerNoReceiptPrinter, "No printer assigned for Receipt/Bill"),
          variant: "destructive",
        });
      } else {
        toast({
          title: t(POS_SETTINGS_I18N.printerPrintError, "Print failed"),
          variant: "destructive",
        });
      }
    } finally {
      setPrinting(false);
    }
  };

  const showQr = Boolean(qrString && !errorKey && !isExpiredUi);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleCancel()}>
      <DialogContent
        className={cn(
          "flex max-h-[min(90dvh,760px)] w-[min(94vw,440px)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-0 bg-white p-0 shadow-xl",
          "[&>button.absolute]:hidden",
        )}
      >
        <DialogTitle className="sr-only">
          {t("pos.payment.qris.title", "QRIS Payment")}
        </DialogTitle>

        <PosQrisHeader
          onCancel={handleCancel}
          cancelDisabled={isCancelling || isCreating || isSimulating}
        />

        <PosQrisAmount amountDue={amountDue} />

        {isSandbox ? (
          <div className="flex justify-center pt-1">
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              {t("pos.payment.qris.sandboxBadge", "Sandbox")}
            </span>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto px-4 py-4">
          {showQr ? (
            <PosQrisQrImage qrString={qrString!} size={260} />
          ) : (
            <div className="flex h-[260px] w-[260px] items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
              {isCreating
                ? t("pos.payment.qris.creating", "Creating QR…")
                : isExpiredUi
                  ? t("pos.payment.qris.expired", "QR expired")
                  : "—"}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="h-10 w-full max-w-[280px] border-primary/50 text-primary"
            disabled={!showQr || printing || isCreating || isCancelling}
            onClick={() => void handlePrint()}
          >
            {printing
              ? t("pos.payment.qris.printing", "Printing…")
              : t("pos.payment.qris.printQr", "Cetak QR Code")}
          </Button>

          <PosQrisMerchantInfo outletName={outletName} outletAddress={outletAddress} />

          {statusLabel ? (
            <p
              className={cn(
                "text-center text-sm font-medium",
                isPaid ? "text-emerald-600" : isExpiredUi || errorKey ? "text-destructive" : "text-slate-700",
              )}
            >
              {statusLabel}
            </p>
          ) : null}

          {!isPaid && expiresAt && !errorKey ? (
            <PosQrisCountdownRing remainingSeconds={remainingSeconds} />
          ) : null}

          <p className="max-w-[280px] text-center text-[11px] leading-snug text-slate-400">
            {t(
              "pos.payment.qris.disclaimerNoRefund",
              "E-wallet transactions cannot be refunded",
            )}
          </p>

          {isSandbox && showQr && !isPaid ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-1 w-full max-w-[280px] text-xs"
              disabled={isSimulating || isCreating || isCancelling || !paymentRequestId}
              onClick={() => void handleSimulate()}
            >
              {isSimulating
                ? t("pos.payment.qris.simulating", "Simulating…")
                : t("pos.payment.qris.simulatePay", "Simulate payment (Sandbox)")}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
