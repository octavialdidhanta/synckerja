import { Facebook, Instagram, Link2, Phone, X } from "lucide-react";
import type { ReactNode } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatReceiptRupiah } from "../lib/formatReceiptPhone";
import { formatCatalogCheckoutLineLabel } from "@/8-2-1-default-prices/checkout/lib/formatCatalogCheckoutLineLabel";
import type { PosReceiptBranding, PosReceiptTransaction } from "../lib/posReceipt.types";

type PosReceiptDocumentProps = {
  branding: PosReceiptBranding;
  transaction: PosReceiptTransaction;
  showClientBlock?: boolean;
  showServedCollected?: boolean;
  showLinks?: boolean;
  showNote?: boolean;
  className?: string;
};

function LinkIcon({ href, children, label }: { href: string; children: ReactNode; label: string }) {
  if (!href.trim()) return null;
  return (
    <span
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-gray-700"
      title={label}
    >
      {children}
    </span>
  );
}

export function ReceiptRule({ variant = "solid" }: { variant?: "solid" | "dashed" | "double" }) {
  if (variant === "dashed") {
    return <div className="border-t border-dashed border-gray-400" aria-hidden />;
  }
  if (variant === "double") {
    return (
      <div className="space-y-1" aria-hidden>
        <div className="border-t border-gray-800" />
        <div className="border-t border-gray-300" />
      </div>
    );
  }
  return <div className="border-t border-gray-300" aria-hidden />;
}

export function ReceiptMetaRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm leading-snug">
      <span className="text-gray-600">{label}</span>
      <span className={emphasize ? "font-semibold tabular-nums text-gray-900" : "text-right tabular-nums text-gray-900"}>
        {value}
      </span>
    </div>
  );
}

export function ReceiptTotalRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-1.5 ${strong ? "text-base font-bold" : "text-sm"}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function formatQty(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2);
}

export function PosReceiptDocument({
  branding,
  transaction,
  showClientBlock = false,
  showServedCollected = false,
  showLinks = true,
  showNote = true,
  className,
}: PosReceiptDocumentProps) {
  const { t, language } = useAppTranslation();
  const { display, logoUrl, hasOutletLogo, social } = branding;
  const initials = (display.title || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasPayment =
    transaction.paymentMethod ||
    transaction.cashTendered != null ||
    transaction.change != null;

  return (
    <div
      className={`h-fit w-full max-w-[23rem] shrink-0 bg-white px-5 py-8 text-gray-900 shadow-sm ring-1 ring-gray-200 print:shadow-none print:ring-0 ${className ?? ""}`}
    >
      <div className="space-y-3 pb-2 text-center">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="mx-auto h-[120px] w-[120px] rounded-full object-cover" />
        ) : (
          <div className="mx-auto flex h-[120px] w-[120px] items-center justify-center rounded-full bg-gray-200 text-xs text-gray-500">
            {hasOutletLogo || display.title ? initials || "140×140" : "140×140"}
          </div>
        )}
        <p className="text-xl font-bold leading-tight tracking-tight">{display.title || "—"}</p>
        {display.addressLine ? <p className="text-sm leading-6 text-gray-700">{display.addressLine}</p> : null}
        {display.phoneLine ? (
          <p className="flex items-center justify-center gap-1.5 text-sm text-gray-700">
            <Phone className="h-4 w-4 shrink-0" aria-hidden />
            {display.phoneLine}
          </p>
        ) : null}
      </div>

      {transaction.tableNumber ? (
        <p className="mt-3 text-center text-2xl font-bold tracking-wide text-gray-900">
          {t("customerVisits.receipt.table", "Table")} {transaction.tableNumber}
        </p>
      ) : null}

      <div className="my-5">
        <ReceiptRule />
      </div>

      <div className="space-y-0.5 pb-1">
        <ReceiptMetaRow label={transaction.dateLabel} value={transaction.timeLabel} />
        {transaction.receiptNumber ? (
          <ReceiptMetaRow
            label={t("receiptSettings.preview.receiptNumber", "Receipt Number")}
            value={transaction.receiptNumber}
            emphasize
          />
        ) : null}
        {showServedCollected && transaction.servedBy ? (
          <ReceiptMetaRow
            label={t("receiptSettings.preview.servedBy", "Served By")}
            value={transaction.servedBy}
          />
        ) : null}
        {showServedCollected && transaction.collectedBy ? (
          <ReceiptMetaRow
            label={t("receiptSettings.preview.collectedBy", "Collected By")}
            value={transaction.collectedBy}
          />
        ) : null}
      </div>

      {showClientBlock && (transaction.clientName || transaction.ticketId) ? (
        <div className="my-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-left">
          {transaction.clientName ? (
            <p className="text-sm font-medium text-gray-900">{transaction.clientName}</p>
          ) : null}
          {transaction.ticketId ? (
            <p className="mt-0.5 text-xs text-gray-500">{transaction.ticketId}</p>
          ) : null}
        </div>
      ) : null}

      <div className="my-6">
        <ReceiptRule variant="double" />
      </div>

      <div className="space-y-5 pb-2">
        {transaction.lineItems.map((item) => (
          <div key={item.id ?? item.name} className="space-y-1.5">
            <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_5.5rem] items-start gap-x-2 text-sm">
              <span className="font-semibold leading-snug">{item.name}</span>
              <span className="text-center text-gray-600">{formatQty(item.quantity)}</span>
              <span className="text-right font-medium tabular-nums">{formatReceiptRupiah(item.lineTotal)}</span>
            </div>
            {item.modifiers?.map((modifier) => (
              <div
                key={modifier.label}
                className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-x-2 pl-1 text-sm text-gray-600"
              >
                <span className="leading-snug">{modifier.label}</span>
                {typeof modifier.price === "number" ? (
                  <span className="text-right tabular-nums">{formatReceiptRupiah(modifier.price)}</span>
                ) : (
                  <span />
                )}
              </div>
            ))}
            {item.promoLabel ? (
              <div className="flex justify-between gap-3 pl-1 text-sm italic text-gray-600">
                <span>{item.promoLabel}</span>
                <span className="tabular-nums">({formatReceiptRupiah(item.promoAmount ?? 0)})</span>
              </div>
            ) : null}
          </div>
        ))}

        {transaction.globalDiscountLabel && (transaction.globalDiscountAmount ?? 0) > 0 ? (
          <div className="flex justify-between gap-3 border-t border-dashed border-gray-300 pt-3 text-sm text-gray-700">
            <span>{transaction.globalDiscountLabel}</span>
            <span className="tabular-nums">({formatReceiptRupiah(transaction.globalDiscountAmount ?? 0)})</span>
          </div>
        ) : null}
      </div>

      <div className="my-5">
        <ReceiptRule />
      </div>

      <div className="space-y-0.5 pb-1">
        <ReceiptTotalRow
          label={t("receiptSettings.preview.subtotal", "Subtotal")}
          value={formatReceiptRupiah(transaction.subtotal)}
        />
        {transaction.gratuityLines.map((line) => (
          <ReceiptTotalRow
            key={`gratuity-${line.name}`}
            label={formatCatalogCheckoutLineLabel({
              name: line.name,
              amountPercent: line.amount_percent,
              locale: language,
            })}
            value={formatReceiptRupiah(line.amount)}
          />
        ))}
        {transaction.taxLines.map((line) => (
          <ReceiptTotalRow
            key={`tax-${line.name}`}
            label={formatCatalogCheckoutLineLabel({
              name: line.name,
              amountPercent: line.amount_percent,
              locale: language,
            })}
            value={formatReceiptRupiah(line.amount)}
          />
        ))}
        <div className="my-3">
          <ReceiptRule variant="double" />
        </div>
        <ReceiptTotalRow
          label={t("receiptSettings.preview.total", "Total")}
          value={formatReceiptRupiah(transaction.grandTotal)}
          strong
        />
      </div>

      {hasPayment ? (
        <>
          <div className="my-5">
            <ReceiptRule variant="dashed" />
          </div>
          <div className="space-y-0.5 pb-1">
            {transaction.paymentMethod ? (
              <ReceiptTotalRow label={t("customerVisits.table.pay", "Pay")} value={transaction.paymentMethod} />
            ) : null}
            {transaction.paymentReference ? (
              <ReceiptTotalRow
                label={t("customerVisits.checkout.paymentReference", "Payment reference")}
                value={transaction.paymentReference}
              />
            ) : null}
            {transaction.cashTendered != null ? (
              <ReceiptTotalRow
                label={t("receiptSettings.preview.cash", "Cash")}
                value={formatReceiptRupiah(transaction.cashTendered)}
              />
            ) : null}
            {transaction.change != null ? (
              <ReceiptTotalRow
                label={t("receiptSettings.preview.change", "Change")}
                value={formatReceiptRupiah(transaction.change)}
              />
            ) : null}
          </div>
        </>
      ) : null}

      {showLinks ? (
        <>
          <div className="my-6">
            <ReceiptRule />
          </div>
          <div className="pb-2 text-center">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
              {t("receiptSettings.preview.links", "Links")}
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <LinkIcon href={social.websiteUrl ?? ""} label="Website">
                <Link2 className="h-4 w-4" />
              </LinkIcon>
              <LinkIcon href={social.twitterUrl ?? ""} label="Twitter">
                <X className="h-4 w-4" />
              </LinkIcon>
              <LinkIcon href={social.facebookUrl ?? ""} label="Facebook">
                <Facebook className="h-4 w-4" />
              </LinkIcon>
              <LinkIcon href={social.instagramUrl ?? ""} label="Instagram">
                <Instagram className="h-4 w-4" />
              </LinkIcon>
            </div>
          </div>
        </>
      ) : null}

      {showNote && display.notes ? (
        <>
          <div className="my-5">
            <ReceiptRule variant="dashed" />
          </div>
          <div className="pt-1 text-center">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
              {t("receiptSettings.preview.note", "Note")}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{display.notes}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
