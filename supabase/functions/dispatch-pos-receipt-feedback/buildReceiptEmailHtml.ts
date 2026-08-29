import { formatReceiptMoney } from "./formatReceiptMoney.ts";
import { formatReceiptPaymentLabel } from "./paymentLabel.ts";
import type { ReceiptEmailPayload } from "./loadReceiptPayload.ts";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function moneyRow(
  label: string,
  value: string,
  opts?: { bold?: boolean; topBorder?: boolean; bottomBorder?: boolean },
): string {
  const weight = opts?.bold ? "font-weight:700;color:#0f172a;" : "color:#334155;";
  const borders: string[] = [];
  if (opts?.topBorder) borders.push("border-top:1px solid #cbd5e1;");
  if (opts?.bottomBorder) borders.push("border-bottom:1px solid #cbd5e1;");
  const borderCss = borders.join("");
  return `
    <tr>
      <td style="padding:8px 0;font-size:14px;${weight}${borderCss}">${escapeHtml(label)}</td>
      <td style="padding:8px 0;text-align:right;font-variant-numeric:tabular-nums;font-size:14px;white-space:nowrap;${weight}${borderCss}">${escapeHtml(value)}</td>
    </tr>`;
}

export function buildReceiptEmailHtml(args: {
  payload: ReceiptEmailPayload;
  receiptUrl: string;
}): string {
  const { payload, receiptUrl } = args;
  const greeting = payload.customerName
    ? `Halo ${escapeHtml(payload.customerName)},`
    : "Halo,";

  const itemRows = payload.items
    .map((item) => {
      const name = [
        item.service_name,
        item.sub_service_name ? ` · ${item.sub_service_name}` : "",
      ].join("");
      const qtyLabel = `${item.quantity}× ${name}`;
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #cbd5e1;color:#0f172a;font-size:14px;vertical-align:top;">${escapeHtml(qtyLabel)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #cbd5e1;text-align:right;font-variant-numeric:tabular-nums;font-size:14px;white-space:nowrap;vertical-align:top;">${escapeHtml(formatReceiptMoney(item.total_price))}</td>
        </tr>`;
    })
    .join("");

  const summaryRows: string[] = [];
  summaryRows.push(moneyRow("Subtotal", formatReceiptMoney(payload.subtotal)));
  if (payload.gratuityAmount > 0) {
    summaryRows.push(moneyRow("Gratuity", formatReceiptMoney(payload.gratuityAmount)));
  }
  if (payload.taxAmount > 0) {
    summaryRows.push(moneyRow("Pajak", formatReceiptMoney(payload.taxAmount)));
  }
  summaryRows.push(
    moneyRow("TOTAL", formatReceiptMoney(payload.totalAmount), {
      bold: true,
      topBorder: true,
      bottomBorder: true,
    }),
  );

  const paymentRows: string[] = [];
  const method = formatReceiptPaymentLabel(
    payload.paymentMethod,
    payload.paymentReference,
  );
  paymentRows.push(moneyRow("Metode", method, { topBorder: true }));

  const isCash = String(payload.paymentMethod ?? "").toLowerCase() === "cash";
  if (isCash && payload.cashTendered != null) {
    const change = Math.max(
      0,
      Math.round(payload.cashTendered) - Math.round(payload.totalAmount),
    );
    paymentRows.push(moneyRow("Dibayar", formatReceiptMoney(payload.cashTendered)));
    paymentRows.push(
      moneyRow("Kembalian", formatReceiptMoney(change), {
        bold: true,
        topBorder: true,
      }),
    );
  }

  const metaBits: string[] = [
    escapeHtml(payload.dateLabel),
    `Struk #${escapeHtml(payload.receiptNumber || "—")}`,
  ];
  if (payload.customerName) {
    metaBits.push(`Pelanggan: ${escapeHtml(payload.customerName)}`);
  }
  if (payload.tableNumber) {
    metaBits.push(`Meja: ${escapeHtml(payload.tableNumber)}`);
  }

  const outletLine =
    payload.outletName && payload.outletName !== payload.businessName
      ? `<p style="margin:4px 0 0;color:#64748b;font-size:13px;">${escapeHtml(payload.outletName)}</p>`
      : "";

  const footer = payload.footerNotes
    ? `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:12px;line-height:1.5;">${escapeHtml(payload.footerNotes)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="id">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <p style="margin:0 0 16px;color:#0f172a;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 20px;color:#475569;font-size:14px;">Terima kasih telah berkunjung. Berikut struk transaksi Anda.</p>
    <div style="background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
      <h1 style="margin:0;font-size:18px;color:#0f172a;">${escapeHtml(payload.businessName)}</h1>
      ${outletLine}
      <p style="margin:12px 0 0;color:#64748b;font-size:12px;">${metaBits.join(" · ")}</p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;border-top:2px solid #94a3b8;border-collapse:collapse;">
        ${itemRows || `<tr><td style="padding:10px 0;color:#64748b;">Tidak ada item</td><td></td></tr>`}
      </table>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:4px;border-top:2px solid #94a3b8;border-collapse:collapse;">
        ${summaryRows.join("")}
      </table>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:4px;border-collapse:collapse;">
        ${paymentRows.join("")}
      </table>
      ${footer}
    </div>
    <div style="text-align:center;margin-top:24px;">
      <a href="${escapeHtml(receiptUrl)}"
         style="display:inline-block;background:#2074B6;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px;">
        Buka struk &amp; beri feedback
      </a>
      <p style="margin:12px 0 0;color:#94a3b8;font-size:11px;line-height:1.5;">
        Jika tombol tidak berfungsi, salin tautan ini:<br/>
        <a href="${escapeHtml(receiptUrl)}" style="color:#2074B6;word-break:break-all;">${escapeHtml(receiptUrl)}</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildReceiptEmailSubject(businessName: string): string {
  return `Struk dari ${businessName.trim() || "Store"}`;
}
