/** Pure helpers mirrored in dispatch-pos-shift-recap edge function (vitest coverage). */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatShiftRecapMoney(amount: number): string {
  const abs = Math.abs(Math.round(Number(amount) || 0));
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(abs)
    .replace(/^Rp\s?/, "Rp. ");
}

/** Shortage in parentheses; overage plain; zero = Rp. 0 */
export function formatShiftRecapVariance(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const rounded = Math.round(amount);
  if (rounded === 0) return formatShiftRecapMoney(0);
  if (rounded < 0) return `(${formatShiftRecapMoney(Math.abs(rounded))})`;
  return formatShiftRecapMoney(rounded);
}

export function dedupeEmails(emails: string[]): string[] {
  const set = new Set<string>();
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      set.add(email);
    }
  }
  return [...set];
}

export function paymentMethodLabel(method: string, lang: string): string {
  const key = method.toLowerCase();
  const en: Record<string, string> = {
    cash: "Cash",
    card: "Card / EDC",
    edc: "Card / EDC",
    ewallet: "E-Wallet",
    qris: "QRIS",
    transfer: "Transfer",
    unknown: "Other",
  };
  const id: Record<string, string> = {
    cash: "Tunai",
    card: "Kartu / EDC",
    edc: "Kartu / EDC",
    ewallet: "E-Wallet",
    qris: "QRIS",
    transfer: "Transfer",
    unknown: "Lainnya",
  };
  const map = lang === "en" ? en : id;
  return map[key] ?? method;
}

export type ShiftRecapDetailPayload = {
  outlet_name?: string;
  opened_by_name?: string;
  closed_by_name?: string;
  opened_at?: string;
  closed_at?: string | null;
  opening_cash?: number;
  cash_sales?: number;
  cash_from_invoices?: number;
  cash_refunds?: number;
  cash_in_out_net?: number;
  expected_cash?: number;
  closing_cash?: number | null;
  cash_difference?: number | null;
  products_sold_qty?: number;
  refunded_products_qty?: number;
  payment_methods?: Array<{ payment_method?: string; total_collected?: number }>;
};

function formatDateTime(iso: string | undefined | null, lang: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(lang === "en" ? "en-US" : "id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function metricsTable(rows: Array<[string, string, string?]>): string {
  return rows
    .map(([label, value, valueStyle]) =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;">${escapeHtml(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;${valueStyle ?? "color:#0f172a;"}">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
}

export function buildShiftRecapEmailSubject(
  detail: ShiftRecapDetailPayload,
  lang: string,
): string {
  const outlet = detail.outlet_name ?? "Outlet";
  const cashier = detail.closed_by_name ?? detail.opened_by_name ?? "Cashier";
  const date = detail.closed_at ?? detail.opened_at;
  let dateLabel = "";
  if (date) {
    try {
      dateLabel = new Date(date).toLocaleDateString(lang === "en" ? "en-US" : "id-ID");
    } catch {
      dateLabel = "";
    }
  }
  if (lang === "en") {
    return `[${outlet}] Shift Recap — ${dateLabel} — ${cashier}`;
  }
  return `[${outlet}] Rekap Shift — ${dateLabel} — ${cashier}`;
}

export function buildShiftRecapEmailHtml(args: {
  detail: ShiftRecapDetailPayload;
  orgName: string;
  language: string;
}): string {
  const lang = args.language === "en" ? "en" : "id";
  const d = args.detail;
  const labels =
    lang === "en"
      ? {
          title: "Shift Recap",
          openedBy: "Opened by",
          closedBy: "Closed by",
          started: "Shift started",
          ended: "Shift ended",
          cashSection: "Cash",
          orderSection: "Order details",
          paymentsSection: "Payment methods",
          opening: "Opening cash",
          cashSales: "Cash payments",
          cashFromInvoice: "Cash from invoices",
          cashRefunds: "Cash refunds",
          cashInOut: "Cash in / out (net)",
          expected: "Expected cash",
          counted: "Counted cash",
          variance: "Difference",
          productsSold: "Products sold",
          productsRefund: "Refunded products",
          footer: "Sent automatically by Synckerja POS",
        }
      : {
          title: "Rekap Shift",
          openedBy: "Dibuka oleh",
          closedBy: "Ditutup oleh",
          started: "Shift dimulai",
          ended: "Shift berakhir",
          cashSection: "Kas",
          orderSection: "Detail pesanan",
          paymentsSection: "Metode pembayaran",
          opening: "Saldo awal",
          cashSales: "Pembayaran tunai",
          cashFromInvoice: "Tunai dari invoice",
          cashRefunds: "Refund tunai",
          cashInOut: "Kas masuk / keluar (neto)",
          expected: "Kas diharapkan",
          counted: "Kas dihitung",
          variance: "Selisih",
          productsSold: "Produk terjual",
          productsRefund: "Produk direfund",
          footer: "Dikirim otomatis oleh Synckerja POS",
        };

  const variance = d.cash_difference;
  const shortage = variance != null && Math.round(variance) < 0;
  const varianceStyle = shortage ? "color:#dc2626;" : "color:#0f172a;";

  const cashRows: Array<[string, string, string?]> = [
    [labels.opening, formatShiftRecapMoney(Number(d.opening_cash ?? 0))],
    [labels.cashSales, formatShiftRecapMoney(Number(d.cash_sales ?? 0))],
    [labels.cashFromInvoice, formatShiftRecapMoney(Number(d.cash_from_invoices ?? 0))],
    [labels.cashRefunds, formatShiftRecapMoney(Number(d.cash_refunds ?? 0))],
    [labels.cashInOut, formatShiftRecapMoney(Number(d.cash_in_out_net ?? 0))],
    [labels.expected, formatShiftRecapMoney(Number(d.expected_cash ?? 0))],
  ];
  if (d.closing_cash != null) {
    cashRows.push([labels.counted, formatShiftRecapMoney(Number(d.closing_cash))]);
    cashRows.push([labels.variance, formatShiftRecapVariance(variance), varianceStyle]);
  }

  const orderRows: Array<[string, string]> = [
    [labels.productsSold, String(Math.round(Number(d.products_sold_qty ?? 0)))],
    [labels.productsRefund, String(Math.round(Number(d.refunded_products_qty ?? 0)))],
  ];

  const paymentRows = (d.payment_methods ?? [])
    .filter((pm) => Number(pm.total_collected ?? 0) > 0)
    .map(
      (pm) =>
        [
          paymentMethodLabel(String(pm.payment_method ?? "unknown"), lang),
          formatShiftRecapMoney(Number(pm.total_collected ?? 0)),
        ] as [string, string],
    );

  const paymentSection =
    paymentRows.length > 0
      ? `
      <h2 style="font-size:16px;margin:24px 0 8px;">${escapeHtml(labels.paymentsSection)}</h2>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 20px;">
        ${metricsTable(paymentRows)}
      </table>`
      : "";

  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h1 style="font-size:20px;margin:0 0 8px;">${escapeHtml(labels.title)}</h1>
      <p style="margin:0 0 4px;color:#64748b;font-size:14px;">
        <strong>${escapeHtml(d.outlet_name ?? "—")}</strong> · ${escapeHtml(args.orgName)}
      </p>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">
        ${escapeHtml(labels.openedBy)}: ${escapeHtml(d.opened_by_name ?? "—")}<br/>
        ${escapeHtml(labels.closedBy)}: ${escapeHtml(d.closed_by_name ?? "—")}<br/>
        ${escapeHtml(labels.started)}: ${escapeHtml(formatDateTime(d.opened_at, lang))}<br/>
        ${escapeHtml(labels.ended)}: ${escapeHtml(formatDateTime(d.closed_at, lang))}
      </p>
      <h2 style="font-size:16px;margin:0 0 8px;">${escapeHtml(labels.cashSection)}</h2>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 20px;">
        ${metricsTable(cashRows)}
      </table>
      <h2 style="font-size:16px;margin:0 0 8px;">${escapeHtml(labels.orderSection)}</h2>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 20px;">
        ${metricsTable(orderRows)}
      </table>
      ${paymentSection}
      <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">${escapeHtml(labels.footer)}</p>
    </div>
  `;
}
