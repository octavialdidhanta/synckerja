import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API_BASE = "https://graph.facebook.com/v21.0";

export type InvoiceWhatsAppResult = {
  status: "sent" | "failed" | "pending";
  messageId: string | null;
  error?: string;
};

/** Kirim template WhatsApp nota invoice (tanpa gate assignee livechat). */
export async function triggerInvoiceWhatsApp(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    templateName: string;
    phoneNumber: string;
    invoiceNumber: string;
    amount: number;
    customerName: string | null;
    items: unknown[];
  },
): Promise<InvoiceWhatsAppResult> {
  try {
    const { data: waAccount } = await admin
      .from("organization_whatsapp_accounts")
      .select("id, phone_number_id, meta_access_token, is_active")
      .eq("organization_id", args.organizationId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!waAccount?.phone_number_id) {
      return { status: "failed", messageId: null, error: "WhatsApp belum dikonfigurasi." };
    }

    let accessToken = String(waAccount.meta_access_token ?? "").trim();
    if (!accessToken) {
      const { data: orgMeta } = await admin
        .from("organization_meta_config")
        .select("meta_access_token")
        .eq("organization_id", args.organizationId)
        .maybeSingle();
      accessToken = String(orgMeta?.meta_access_token ?? "").trim();
    }

    if (!accessToken) {
      return { status: "failed", messageId: null, error: "Token Meta WhatsApp tidak ditemukan." };
    }

    const toDigits = args.phoneNumber.replace(/\D/g, "");
    if (!toDigits) {
      return { status: "failed", messageId: null, error: "Nomor telepon tidak valid." };
    }

    const formattedAmount = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(args.amount);

    const itemSummary = Array.isArray(args.items)
      ? args.items
          .slice(0, 3)
          .map((it) => {
            if (it && typeof it === "object" && "name" in it) return String((it as { name: string }).name);
            return String(it);
          })
          .join(", ")
      : "-";

    const bodyParams = [
      args.customerName ?? "-",
      args.invoiceNumber,
      formattedAmount,
      itemSummary || "-",
    ];

    const payload = {
      messaging_product: "whatsapp",
      to: toDigits,
      type: "template",
      template: {
        name: args.templateName,
        language: { code: "id" },
        components: [
          {
            type: "body",
            parameters: bodyParams.map((text) => ({ type: "text", text: String(text).slice(0, 1024) })),
          },
        ],
      },
    };

    const url = `${META_API_BASE}/${waAccount.phone_number_id}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      const errMsg =
        (json.error as { message?: string } | undefined)?.message ??
        `Graph API error ${res.status}`;
      console.error("triggerInvoiceWhatsApp:", errMsg, json);
      return { status: "failed", messageId: null, error: errMsg };
    }

    const messages = json.messages as Array<{ id?: string }> | undefined;
    const messageId = messages?.[0]?.id ?? null;
    return { status: "sent", messageId: messageId ? String(messageId) : null };
  } catch (e) {
    console.error("triggerInvoiceWhatsApp:", e);
    return {
      status: "failed",
      messageId: null,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
