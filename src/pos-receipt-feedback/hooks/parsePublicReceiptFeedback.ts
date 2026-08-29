export type PublicReceiptFeedbackItem = {
  id: string;
  service_name: string;
  sub_service_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type PublicReceiptFeedbackTransaction = {
  receipt_number: string;
  date: string;
  created_at: string;
  total_amount: number;
  checkout_subtotal: number | null;
  checkout_tax_amount: number | null;
  checkout_gratuity_amount: number | null;
  payment_method: string | null;
  payment_reference: string | null;
  cash_tendered: number | null;
  table_number: string | null;
  items: PublicReceiptFeedbackItem[];
};

export type PublicReceiptFeedbackDto = {
  token: string;
  alreadySubmitted: boolean;
  rating: number | null;
  comment: string | null;
  replyText: string | null;
  businessName: string;
  outletName: string;
  customerName: string;
  footerNotes: string;
  transaction: PublicReceiptFeedbackTransaction;
  thankYouMessage: string;
};

function parseTransaction(raw: unknown): PublicReceiptFeedbackTransaction {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  return {
    receipt_number: String(o.receipt_number ?? ''),
    date: String(o.date ?? ''),
    created_at: String(o.created_at ?? ''),
    total_amount: Number(o.total_amount ?? 0),
    checkout_subtotal: o.checkout_subtotal != null ? Number(o.checkout_subtotal) : null,
    checkout_tax_amount: o.checkout_tax_amount != null ? Number(o.checkout_tax_amount) : null,
    checkout_gratuity_amount: o.checkout_gratuity_amount != null ? Number(o.checkout_gratuity_amount) : null,
    payment_method: o.payment_method != null ? String(o.payment_method) : null,
    payment_reference: o.payment_reference != null ? String(o.payment_reference) : null,
    cash_tendered: o.cash_tendered != null ? Number(o.cash_tendered) : null,
    table_number: o.table_number != null ? String(o.table_number) : null,
    items: itemsRaw.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        id: String(row.id ?? ''),
        service_name: String(row.service_name ?? ''),
        sub_service_name: row.sub_service_name != null ? String(row.sub_service_name) : null,
        quantity: Number(row.quantity ?? 0),
        unit_price: Number(row.unit_price ?? 0),
        total_price: Number(row.total_price ?? 0),
      };
    }),
  };
}

export function parsePublicReceiptFeedbackPayload(
  raw: unknown,
): { ok: true; data: PublicReceiptFeedbackDto } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid' };
  const o = raw as Record<string, unknown>;
  if (o.ok !== true) return { ok: false, error: String(o.error ?? 'unknown') };
  const token = String(o.token ?? '');
  if (!token) return { ok: false, error: 'invalid' };
  return {
    ok: true,
    data: {
      token,
      alreadySubmitted: Boolean(o.already_submitted),
      rating: o.rating != null ? Number(o.rating) : null,
      comment: o.comment != null ? String(o.comment) : null,
      replyText: o.reply_text != null ? String(o.reply_text) : null,
      businessName: String(o.business_name ?? ''),
      outletName: String(o.outlet_name ?? ''),
      customerName: String(o.customer_name ?? ''),
      footerNotes: String(o.footer_notes ?? ''),
      transaction: parseTransaction(o.transaction),
      thankYouMessage: String(o.thank_you_message ?? 'Thank you for your feedback!'),
    },
  };
}
