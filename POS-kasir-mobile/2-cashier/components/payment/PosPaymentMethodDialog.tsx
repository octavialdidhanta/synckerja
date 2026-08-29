import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import type { CustomerVisitCheckoutPaymentMethod } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { usePaymentMethodChannels } from "@/8-2-10-reports/payment-methods/hooks/usePaymentMethodChannels";
import { usePosQrisEligibility } from "@/shared/pos-qris";
import { cn } from "@/shared/lib/utils";
import { POS_PAYMENT_DIALOG_I18N } from "../../lib/posPaymentDialogCopy";
import { quickCashAmounts } from "../../lib/quickCashAmounts";

export type PosPaymentConfirmPayload = {
  paymentMethod: CustomerVisitCheckoutPaymentMethod;
  cashTendered: number | null;
  walletLabel: string | null;
  paymentChannelId: string | null;
  paymentReference: string | null;
  notes: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletId: string;
  amountDue: number;
  serverName: string;
  paying?: boolean;
  onConfirm: (payload: PosPaymentConfirmPayload) => void;
};

function PaymentMethodGroup({
  title,
  active,
  children,
}: {
  title: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-white p-3 shadow-sm transition-colors",
        active ? "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20" : "border-slate-200",
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={cn(
            "h-4 w-1 shrink-0 rounded-full",
            active ? "bg-primary" : "bg-slate-300",
          )}
          aria-hidden
        />
        <h3
          className={cn(
            "text-sm font-semibold tracking-tight",
            active ? "text-primary" : "text-slate-800",
          )}
        >
          {title}
        </h3>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function PosPaymentMethodDialog({
  open,
  onOpenChange,
  outletId,
  amountDue,
  serverName,
  paying,
  onConfirm,
}: Props) {
  const { t } = useAppTranslation();
  const { channels, isLoading: channelsLoading } = usePaymentMethodChannels({
    outletId,
    enabled: open && Boolean(outletId),
  });
  const { isEligible: qrisEligible, qrisChannel, isSandbox, isLoading: qrisLoading } =
    usePosQrisEligibility(outletId);
  const [method, setMethod] = useState<"cash" | "e_wallet" | "bank_transfer" | "qris">("cash");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [tendered, setTendered] = useState(String(Math.round(amountDue)));
  const [notes, setNotes] = useState("");

  const cashChannel = useMemo(
    () => channels.find((ch) => ch.category === "cash" && ch.slug === "cash") ?? channels.find((ch) => ch.category === "cash") ?? null,
    [channels],
  );
  const ewalletChannels = useMemo(
    () => channels.filter((ch) => ch.category === "e_wallet"),
    [channels],
  );
  const edcChannels = useMemo(
    () => channels.filter((ch) => ch.category === "edc"),
    [channels],
  );

  useEffect(() => {
    if (!open) return;
    setMethod("cash");
    setSelectedChannelId(cashChannel?.id ?? null);
    setTendered(String(Math.round(amountDue)));
    setNotes("");
  }, [open, amountDue, cashChannel?.id]);

  const quick = useMemo(() => quickCashAmounts(amountDue), [amountDue]);
  const tenderedNum = Number(tendered.replace(/\D/g, "")) || 0;

  const selectedChannel = useMemo(
    () => channels.find((ch) => ch.id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  );

  const canPay =
    !paying &&
    !channelsLoading &&
    !qrisLoading &&
    amountDue > 0 &&
    (method === "qris"
      ? qrisEligible
      : method === "cash"
        ? tenderedNum >= amountDue && Boolean(cashChannel?.id)
        : Boolean(selectedChannelId));

  const resolvePayload = (): PosPaymentConfirmPayload => {
    if (method === "qris") {
      return {
        paymentMethod: "qris",
        cashTendered: amountDue,
        walletLabel: "QRIS",
        paymentChannelId: qrisChannel?.id ?? null,
        paymentReference: "qris",
        notes: notes.trim(),
      };
    }
    if (method === "cash") {
      return {
        paymentMethod: "cash",
        cashTendered: tenderedNum,
        walletLabel: null,
        paymentChannelId: cashChannel?.id ?? null,
        paymentReference: cashChannel?.slug ?? "cash",
        notes: notes.trim(),
      };
    }
    const channel = selectedChannel;
    return {
      paymentMethod: method,
      cashTendered: amountDue,
      walletLabel: channel?.name ?? null,
      paymentChannelId: channel?.id ?? null,
      paymentReference: channel?.slug ?? null,
      notes: notes.trim(),
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(86dvh,720px)] w-[min(94vw,640px)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        <div className="relative flex items-center justify-center border-b border-slate-100 px-3 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 border-primary text-primary"
            onClick={() => onOpenChange(false)}
            disabled={paying}
          >
            {t(POS_PAYMENT_DIALOG_I18N.cancel, "Cancel")}
          </Button>
          <DialogTitle className="text-lg font-bold tabular-nums">
            {formatStoreCheckoutRp(amountDue)}
          </DialogTitle>
          <Button
            type="button"
            size="sm"
            className="absolute right-3 top-1/2 -translate-y-1/2"
            disabled={!canPay}
            onClick={() => {
              if (!canPay) return;
              onConfirm(resolvePayload());
            }}
          >
            {paying
              ? t(POS_PAYMENT_DIALOG_I18N.paying, "Paying…")
              : t(POS_PAYMENT_DIALOG_I18N.pay, "Pay")}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/80 px-4 py-3">
          <div className="mb-3 space-y-1">
            <p className="text-xs text-slate-500">
              {t(POS_PAYMENT_DIALOG_I18N.server, "Server")} | {serverName || "—"}
            </p>
            <p className="text-xs text-primary">
              {t(POS_PAYMENT_DIALOG_I18N.splitPaySoon, "Split payment across methods — coming soon")}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <PaymentMethodGroup
              title={t(POS_PAYMENT_DIALOG_I18N.cash, "Cash")}
              active={method === "cash"}
            >
              <div className="mb-2 grid grid-cols-3 gap-2">
                {quick.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setMethod("cash");
                      setSelectedChannelId(cashChannel?.id ?? null);
                      setTendered(String(amt));
                    }}
                    className={cn(
                      "rounded-md border px-2 py-2.5 text-sm font-medium tabular-nums",
                      method === "cash" && tenderedNum === amt
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-primary/40 bg-white text-primary",
                    )}
                  >
                    {formatStoreCheckoutRp(amt)}
                  </button>
                ))}
              </div>
              <Input
                value={tendered}
                onChange={(e) => {
                  setMethod("cash");
                  setSelectedChannelId(cashChannel?.id ?? null);
                  setTendered(e.target.value.replace(/\D/g, ""));
                }}
                className="h-11 border-slate-200 bg-white text-base font-semibold tabular-nums"
                inputMode="numeric"
              />
            </PaymentMethodGroup>

            {qrisEligible ? (
              <PaymentMethodGroup
                title={t("pos.payment.qris.title", "QRIS Payment")}
                active={method === "qris"}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMethod("qris");
                    setSelectedChannelId(qrisChannel?.id ?? null);
                  }}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border bg-white px-3 py-3.5",
                    method === "qris"
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-slate-200",
                  )}
                >
                  <img
                    src="/qris1.png"
                    alt="QRIS"
                    className="h-8 w-auto object-contain"
                  />
                  {isSandbox ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      {t("pos.payment.qris.sandboxBadge", "Sandbox")}
                    </span>
                  ) : null}
                </button>
              </PaymentMethodGroup>
            ) : null}

            {ewalletChannels.length > 0 ? (
              <PaymentMethodGroup
                title={t(POS_PAYMENT_DIALOG_I18N.ewallet, "E-Wallet")}
                active={method === "e_wallet"}
              >
                <div className="grid grid-cols-3 gap-2">
                  {ewalletChannels.map((wallet) => {
                    const active = method === "e_wallet" && selectedChannelId === wallet.id;
                    return (
                      <button
                        key={wallet.id}
                        type="button"
                        onClick={() => {
                          setMethod("e_wallet");
                          setSelectedChannelId(wallet.id);
                        }}
                        className={cn(
                          "rounded-md border px-2 py-3 text-sm font-semibold",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-slate-200 bg-white text-slate-800",
                        )}
                      >
                        {wallet.name}
                      </button>
                    );
                  })}
                </div>
              </PaymentMethodGroup>
            ) : null}

            {edcChannels.length > 0 ? (
              <PaymentMethodGroup
                title={t(POS_PAYMENT_DIALOG_I18N.bankTransfer, "Bank Transfer / EDC")}
                active={method === "bank_transfer"}
              >
                <div className="grid grid-cols-3 gap-2">
                  {edcChannels.map((edc) => {
                    const active = method === "bank_transfer" && selectedChannelId === edc.id;
                    return (
                      <button
                        key={edc.id}
                        type="button"
                        onClick={() => {
                          setMethod("bank_transfer");
                          setSelectedChannelId(edc.id);
                        }}
                        className={cn(
                          "rounded-md border px-2 py-3 text-sm font-semibold",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-slate-200 bg-white text-slate-800",
                        )}
                      >
                        {edc.name}
                      </button>
                    );
                  })}
                </div>
              </PaymentMethodGroup>
            ) : null}

            <PaymentMethodGroup title={t(POS_PAYMENT_DIALOG_I18N.notes, "Additional notes")}>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t(POS_PAYMENT_DIALOG_I18N.notes, "Additional notes")}
                className="h-10 border-slate-200 bg-white"
              />
            </PaymentMethodGroup>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
