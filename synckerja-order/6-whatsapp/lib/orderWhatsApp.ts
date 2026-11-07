/** Pure helpers for the Synckerja Order floating WhatsApp button (no React, no Supabase). */

export const ORDER_WHATSAPP_MESSAGE_MAX = 300;

/** Used when the outlet leaves "Pesan pembuka" empty. */
export const ORDER_WHATSAPP_DEFAULT_MESSAGE = "Halo {outlet}, saya mau tanya soal pesanan.";

/** Same message, used when the guest scanned a table QR. */
export const ORDER_WHATSAPP_DEFAULT_TABLE_MESSAGE =
  "Halo {outlet}, saya di meja {meja}, mau tanya soal pesanan.";

export const ORDER_WHATSAPP_PLACEHOLDERS = ["{outlet}", "{meja}"] as const;

export const ORDER_WHATSAPP_ICON_SRC = "/synckerja-order/whatsapp.png";

/** Select value meaning "hide the button for this outlet". */
export const ORDER_WHATSAPP_NONE = "__none__";

export type OrderWhatsAppAccountOption = {
  id: string;
  businessName: string | null;
  displayPhoneNumber: string | null;
};

export type PublicOrderWhatsApp =
  | { ok: true; phone_digits: string; prefill_message: string | null }
  | { ok: false; error?: string };

export function phoneDigits(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\D/g, "");
}

/** Fill {outlet} / {meja}. Empty template → default message (table-aware). */
export function fillOrderWhatsAppMessage(
  template: string | null | undefined,
  ctx: { outletName: string; tableName?: string | null },
): string {
  const table = ctx.tableName?.trim() ?? "";
  const base =
    template?.trim() ||
    (table ? ORDER_WHATSAPP_DEFAULT_TABLE_MESSAGE : ORDER_WHATSAPP_DEFAULT_MESSAGE);
  return base
    .replace(/\{outlet\}/gi, ctx.outletName.trim())
    .replace(/\{meja\}/gi, table)
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function buildOrderWhatsAppUrl(digits: string, message?: string | null): string | null {
  const phone = phoneDigits(digits);
  if (phone.length < 8) return null;
  const text = message?.trim();
  return text ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/${phone}`;
}

/** Dropdown label, kept short: "Nama Bisnis · +62 812-3456-7890". */
export function orderWhatsAppAccountLabel(account: OrderWhatsAppAccountOption): string {
  const phone = account.displayPhoneNumber?.trim() || "";
  const name = account.businessName?.trim() || "";
  if (name && phone) return `${name} · ${phone}`;
  return name || phone || "WhatsApp";
}

/**
 * Which account the outlet effectively uses — mirrors `get_public_synckerja_order_whatsapp`.
 * Returns null when the button would be hidden.
 */
export function resolveOutletWhatsAppAccountId(args: {
  buttonEnabled: boolean;
  selectedAccountId: string | null;
  accounts: OrderWhatsAppAccountOption[];
}): string | null {
  if (!args.buttonEnabled) return null;
  if (args.selectedAccountId) {
    return args.accounts.some((a) => a.id === args.selectedAccountId) ? args.selectedAccountId : null;
  }
  return args.accounts.length === 1 ? args.accounts[0].id : null;
}
