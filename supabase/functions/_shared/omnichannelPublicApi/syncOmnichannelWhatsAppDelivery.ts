import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type OmnichannelWhatsAppStatus = "pending" | "sent" | "delivered" | "failed" | "skipped";

/** Meta outbound status rank (mirrors whatsapp-webhook metaDeliveryRank). */
export function omnichannelDeliveryRank(status: string): number | null {
  const s = status.trim().toLowerCase();
  if (s === "read") return 4;
  if (s === "delivered") return 3;
  if (s === "sent") return 2;
  if (s === "failed") return -1;
  return null;
}

export function mapMetaStatusToOmnichannelStatus(
  metaStatus: string,
): OmnichannelWhatsAppStatus | null {
  const s = metaStatus.trim().toLowerCase();
  if (s === "failed") return "failed";
  if (s === "delivered" || s === "read") return "delivered";
  if (s === "sent") return "sent";
  return null;
}

export function shouldUpgradeOmnichannelStatus(
  current: string | null | undefined,
  incoming: OmnichannelWhatsAppStatus,
): boolean {
  if (incoming === "failed") return true;

  const cur = String(current ?? "").trim().toLowerCase();
  if (cur === "skipped") return false;
  if (cur === "failed") return false;

  const incRank = omnichannelDeliveryRank(incoming);
  if (incRank === null || incRank === -1) return false;

  const curRank = omnichannelDeliveryRank(cur);
  if (curRank === null || curRank === -1) return true;
  return incRank >= curRank;
}

export function buildMetaDeliverySkipReason(statusPayload: Record<string, unknown>): string {
  const errors = statusPayload.errors;
  const firstErr =
    Array.isArray(errors) && errors.length > 0 && errors[0] && typeof errors[0] === "object"
      ? (errors[0] as Record<string, unknown>)
      : null;

  const code = firstErr?.code != null ? String(firstErr.code).trim() : "";
  const message = String(
    firstErr?.message ?? firstErr?.title ?? statusPayload.status ?? "delivery_failed",
  ).trim();

  const codePart = code ? `#${code}:` : "";
  return `meta_delivery:${codePart}${message}`.slice(0, 500);
}

async function patchLeadSubmissions(
  admin: SupabaseClient,
  waMessageId: string,
  incoming: OmnichannelWhatsAppStatus,
  skipReason: string | null,
): Promise<number> {
  const { data: rows, error: fetchErr } = await admin
    .from("lead_submissions")
    .select("id, organization_id, whatsapp_status")
    .eq("whatsapp_message_id", waMessageId);

  if (fetchErr) {
    console.error("syncOmnichannelWhatsAppDelivery lead_submissions fetch:", fetchErr);
    return 0;
  }

  let updated = 0;
  const now = new Date().toISOString();

  for (const row of rows ?? []) {
    const current = row.whatsapp_status as string | null;
    if (!shouldUpgradeOmnichannelStatus(current, incoming)) continue;

    const patch: Record<string, unknown> = {
      whatsapp_status: incoming,
      updated_at: now,
    };
    if (incoming === "failed" && skipReason) {
      patch.whatsapp_skip_reason = skipReason;
    }

    const { error: updErr } = await admin
      .from("lead_submissions")
      .update(patch)
      .eq("id", row.id);

    if (updErr) {
      console.error("syncOmnichannelWhatsAppDelivery lead_submissions update:", updErr);
      continue;
    }

    updated += 1;
    console.log("syncOmnichannelWhatsAppDelivery: lead_submissions", {
      id: row.id,
      organization_id: row.organization_id,
      from: current,
      to: incoming,
    });
  }

  return updated;
}

async function patchSalesInvoices(
  admin: SupabaseClient,
  waMessageId: string,
  incoming: OmnichannelWhatsAppStatus,
  skipReason: string | null,
): Promise<number> {
  const { data: rows, error: fetchErr } = await admin
    .from("sales_invoices")
    .select("id, organization_id, whatsapp_status")
    .eq("whatsapp_message_id", waMessageId);

  if (fetchErr) {
    console.error("syncOmnichannelWhatsAppDelivery sales_invoices fetch:", fetchErr);
    return 0;
  }

  let updated = 0;
  const now = new Date().toISOString();

  for (const row of rows ?? []) {
    const current = row.whatsapp_status as string | null;
    if (!shouldUpgradeOmnichannelStatus(current, incoming)) continue;

    const patch: Record<string, unknown> = {
      whatsapp_status: incoming,
      updated_at: now,
    };
    if (incoming === "failed" && skipReason) {
      patch.whatsapp_skip_reason = skipReason;
    }

    const { error: updErr } = await admin
      .from("sales_invoices")
      .update(patch)
      .eq("id", row.id);

    if (updErr) {
      console.error("syncOmnichannelWhatsAppDelivery sales_invoices update:", updErr);
      continue;
    }

    updated += 1;
    console.log("syncOmnichannelWhatsAppDelivery: sales_invoices", {
      id: row.id,
      organization_id: row.organization_id,
      from: current,
      to: incoming,
    });
  }

  return updated;
}

/** Propagate Meta delivery webhook status to lead_submissions + sales_invoices by wamid. */
export async function syncOmnichannelWhatsAppDelivery(
  admin: SupabaseClient,
  args: {
    waMessageId: string;
    metaStatus: string;
    statusPayload: Record<string, unknown>;
    statusTimestampIso: string;
  },
): Promise<void> {
  const waMessageId = args.waMessageId.trim();
  if (!waMessageId) return;

  const incoming = mapMetaStatusToOmnichannelStatus(args.metaStatus);
  if (!incoming) return;

  // sent from webhook is redundant when API already set sent; still allow if row is pending.
  if (incoming === "sent") {
    // Only upgrade pending → sent (invoice rows start as pending).
    await patchLeadSubmissions(admin, waMessageId, incoming, null);
    await patchSalesInvoices(admin, waMessageId, incoming, null);
    return;
  }

  const skipReason =
    incoming === "failed" ? buildMetaDeliverySkipReason(args.statusPayload) : null;

  await Promise.all([
    patchLeadSubmissions(admin, waMessageId, incoming, skipReason),
    patchSalesInvoices(admin, waMessageId, incoming, skipReason),
  ]);

  void args.statusTimestampIso;
}
