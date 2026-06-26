import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type InvoiceItem = {
  name: string;
  qty: number;
  price: number;
};

function parseInvoiceItems(raw: unknown[]): InvoiceItem[] {
  return raw
    .map((it) => {
      if (!it || typeof it !== "object") return null;
      const o = it as Record<string, unknown>;
      const name = String(o.name ?? "").trim();
      const qty = Number(o.qty ?? 1);
      const price = Number(o.price ?? 0);
      if (!name || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price)) return null;
      return { name, qty, price };
    })
    .filter((x): x is InvoiceItem => x != null);
}

/** Mirror UI `createConvertedSalesActivity` for omnichannel invoice-trigger. */
export async function createLeadConversionSalesActivity(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    leadId: string;
    clientName: string;
    clientPhone: string | null;
    clientEmail: string | null;
    createdByUserId: string;
    totalAmount: number;
    items: unknown[];
    invoiceNumber: string;
  },
): Promise<string | null> {
  const parsedItems = parseInvoiceItems(args.items);
  if (parsedItems.length === 0) return null;

  const activityId = crypto.randomUUID();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const { error: actErr } = await admin.from("sales_activities").insert({
    id: activityId,
    organization_id: args.organizationId,
    lead_id: args.leadId,
    client_name: args.clientName,
    client_phone: args.clientPhone,
    client_email: args.clientEmail,
    activity_type: "Lead Conversion",
    status: "Converted",
    date: today,
    created_by: args.createdByUserId,
    total_amount: args.totalAmount,
    description: `Invoice ${args.invoiceNumber} via Website form`,
    created_at: now,
    updated_at: now,
  });

  if (actErr) {
    console.error("createLeadConversionSalesActivity insert:", actErr);
    return null;
  }

  const itemRows = parsedItems.map((it) => ({
    sales_activity_id: activityId,
    organization_id: args.organizationId,
    service_id: null,
    sub_service_id: null,
    service_name: it.name,
    sub_service_name: null,
    quantity: it.qty,
    unit_price: it.price,
    total_price: it.qty * it.price,
    notes: null,
    created_at: now,
    updated_at: now,
  }));

  const { error: itemErr } = await admin.from("sales_activity_items").insert(itemRows);
  if (itemErr) {
    console.error("createLeadConversionSalesActivity items:", itemErr);
    await admin.from("sales_activities").delete().eq("id", activityId);
    return null;
  }

  return activityId;
}
