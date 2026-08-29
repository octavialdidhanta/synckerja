import { formatToRupiah } from "@/shared/utils/formatCurrency";
import type { PublicReceiptFeedbackTransaction } from "../hooks/parsePublicReceiptFeedback";
import { formatReceiptPaymentLabel } from "../lib/formatReceiptPaymentLabel";
import { isGenericCustomerName } from "../lib/isGenericCustomerName";

type Props = {
  businessName: string;
  outletName: string;
  customerName: string;
  footerNotes: string;
  receiptDate: string;
  transaction: PublicReceiptFeedbackTransaction;
};

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-2 ${bold ? "font-semibold text-foreground" : ""} ${muted ? "text-muted-foreground" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function PosPublicReceiptBreakdown({
  businessName,
  outletName,
  customerName,
  footerNotes,
  receiptDate,
  transaction: tx,
}: Props) {
  const showName = customerName && !isGenericCustomerName(customerName);
  const subtotal = tx.checkout_subtotal ?? tx.total_amount;
  const tax = tx.checkout_tax_amount ?? 0;
  const gratuity = tx.checkout_gratuity_amount ?? 0;
  const isCash = String(tx.payment_method ?? "").toLowerCase() === "cash";
  const change =
    isCash && tx.cash_tendered != null
      ? Math.max(0, Math.round(tx.cash_tendered) - Math.round(tx.total_amount))
      : null;

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <header className="mb-3 text-center sm:text-left">
        <h1 className="text-lg font-bold">{businessName}</h1>
        {outletName && outletName !== businessName ? (
          <p className="text-sm text-muted-foreground">{outletName}</p>
        ) : null}
      </header>

      <p className="mb-1 text-xs text-muted-foreground">{receiptDate}</p>
      <p className="mb-3 text-sm">
        Struk #{tx.receipt_number || "—"}
        {showName ? ` · ${customerName}` : ""}
        {tx.table_number ? ` · Meja ${tx.table_number}` : ""}
      </p>

      <div className="border-t-2 border-slate-400 pt-1 text-sm">
        {tx.items.map((item) => (
          <div
            key={item.id}
            className="flex justify-between gap-2 border-b border-slate-300 py-2.5"
          >
            <span>
              {item.quantity}× {item.service_name}
              {item.sub_service_name ? ` · ${item.sub_service_name}` : ""}
            </span>
            <span className="tabular-nums">{formatToRupiah(item.total_price)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t-2 border-slate-400 pt-3 text-sm">
        <Row label="Subtotal" value={formatToRupiah(subtotal)} />
        {gratuity > 0 ? (
          <Row label="Gratuity" value={formatToRupiah(gratuity)} />
        ) : null}
        {tax > 0 ? <Row label="Pajak" value={formatToRupiah(tax)} /> : null}
        <div className="border-y border-slate-300 py-2">
          <Row label="TOTAL" value={formatToRupiah(tx.total_amount)} bold />
        </div>
      </div>

      <div className="mt-1 space-y-2 border-t border-slate-300 pt-3 text-sm">
        <Row
          label="Metode"
          value={formatReceiptPaymentLabel(tx.payment_method, tx.payment_reference)}
          muted
        />
        {isCash && tx.cash_tendered != null ? (
          <>
            <Row label="Dibayar" value={formatToRupiah(tx.cash_tendered)} />
            <div className="border-t border-slate-300 pt-2">
              <Row label="Kembalian" value={formatToRupiah(change ?? 0)} bold />
            </div>
          </>
        ) : null}
      </div>

      {footerNotes ? (
        <p className="mt-3 border-t border-slate-200 pt-3 text-center text-xs text-muted-foreground">
          {footerNotes}
        </p>
      ) : null}
    </section>
  );
}
