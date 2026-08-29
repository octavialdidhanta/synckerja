import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { personalCustomerName } from "./isGenericCustomerName.ts";

export type ReceiptEmailItem = {
  id: string;
  service_name: string;
  sub_service_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type ReceiptEmailPayload = {
  businessName: string;
  outletName: string;
  customerName: string | null;
  footerNotes: string;
  receiptNumber: string;
  dateLabel: string;
  tableNumber: string | null;
  items: ReceiptEmailItem[];
  subtotal: number;
  taxAmount: number;
  gratuityAmount: number;
  totalAmount: number;
  paymentMethod: string | null;
  paymentReference: string | null;
  cashTendered: number | null;
};

type InvitationLite = {
  sales_activity_id: string;
  organization_id: string;
  pos_outlet_id: string | null;
  customer_name: string | null;
};

export async function loadReceiptPayload(
  admin: SupabaseClient,
  inv: InvitationLite,
): Promise<ReceiptEmailPayload | null> {
  const { data: sa, error: saErr } = await admin
    .from("sales_activities")
    .select(
      "id, date, created_at, total_amount, checkout_subtotal, checkout_tax_amount, checkout_gratuity_amount, payment_method, payment_reference, cash_tendered, table_number, client_name",
    )
    .eq("id", inv.sales_activity_id)
    .maybeSingle();

  if (saErr || !sa) return null;

  const { data: itemsRaw } = await admin
    .from("sales_activity_items")
    .select("id, service_name, sub_service_name, quantity, unit_price, total_price, created_at")
    .eq("sales_activity_id", sa.id)
    .order("created_at", { ascending: true });

  const { data: org } = await admin
    .from("organizations")
    .select("company_name")
    .eq("id", inv.organization_id)
    .maybeSingle();

  let outletName = "";
  if (inv.pos_outlet_id) {
    const { data: outlet } = await admin
      .from("pos_outlets")
      .select("name")
      .eq("id", inv.pos_outlet_id)
      .maybeSingle();
    outletName = String(outlet?.name ?? "").trim();
  }

  let footerNotes = "";
  if (inv.pos_outlet_id) {
    const { data: settings } = await admin
      .from("pos_outlet_receipt_settings")
      .select("footer_notes")
      .eq("outlet_id", inv.pos_outlet_id)
      .maybeSingle();
    footerNotes = String(settings?.footer_notes ?? "").trim();
  }

  const businessName =
    outletName ||
    String(org?.company_name ?? "").trim() ||
    "Store";

  const createdAt = sa.created_at ? new Date(String(sa.created_at)) : null;
  let dateLabel = String(sa.date ?? "").trim();
  if (createdAt && !Number.isNaN(createdAt.getTime())) {
    dateLabel = createdAt.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const receiptNumber = String(sa.id).replace(/-/g, "").slice(0, 7);

  const items: ReceiptEmailItem[] = (itemsRaw ?? []).map((row) => ({
    id: String(row.id),
    service_name: String(row.service_name ?? ""),
    sub_service_name: row.sub_service_name != null ? String(row.sub_service_name) : null,
    quantity: Number(row.quantity ?? 0),
    unit_price: Number(row.unit_price ?? 0),
    total_price: Number(row.total_price ?? 0),
  }));

  return {
    businessName,
    outletName,
    customerName: personalCustomerName(inv.customer_name) ??
      personalCustomerName(sa.client_name as string | null),
    footerNotes,
    receiptNumber,
    dateLabel: dateLabel || "—",
    tableNumber: sa.table_number != null ? String(sa.table_number).trim() || null : null,
    items,
    subtotal: Number(sa.checkout_subtotal ?? sa.total_amount ?? 0),
    taxAmount: Number(sa.checkout_tax_amount ?? 0),
    gratuityAmount: Number(sa.checkout_gratuity_amount ?? 0),
    totalAmount: Number(sa.total_amount ?? 0),
    paymentMethod: sa.payment_method != null ? String(sa.payment_method) : null,
    paymentReference: sa.payment_reference != null ? String(sa.payment_reference) : null,
    cashTendered: sa.cash_tendered != null ? Number(sa.cash_tendered) : null,
  };
}
