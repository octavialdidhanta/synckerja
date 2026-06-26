import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  resolveOrganizationWhatsAppCredentials,
  WA_ACCOUNT_NOT_MAPPED_CODE,
  WA_ACCOUNT_NOT_MAPPED_ERROR,
} from "./resolveOrganizationWhatsAppCredentials.ts";

const META_API_BASE = "https://graph.facebook.com/v21.0";

export type InvoiceWhatsAppResult = {
  status: "sent" | "failed" | "skipped" | "pending";
  messageId: string | null;
  skipReason?: string | null;
  error?: string;
};

/** Kirim template WhatsApp nota invoice (tanpa gate assignee livechat). */
export async function triggerInvoiceWhatsApp(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    webId: string;
    templateName: string;
    templateLanguage?: string | null;
    phoneNumber: string;
    invoiceNumber: string;
    amount: number;
    customerName: string | null;
    items: unknown[];
  },
): Promise<InvoiceWhatsAppResult> {
  try {
    const creds = await resolveOrganizationWhatsAppCredentials(admin, args.organizationId, {
      webId: args.webId,
    });
    if (!creds.ok) {
      const isNotMapped =
        creds.code === WA_ACCOUNT_NOT_MAPPED_CODE ||
        creds.error === WA_ACCOUNT_NOT_MAPPED_ERROR;
      return {
        status: "skipped",
        messageId: null,
        skipReason: isNotMapped ? WA_ACCOUNT_NOT_MAPPED_ERROR : undefined,
        error: creds.error,
      };
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

    const languageCode = (args.templateLanguage ?? "id").trim() || "id";

    const payload = {
      messaging_product: "whatsapp",
      to: toDigits,
      type: "template",
      template: {
        name: args.templateName,
        language: { code: languageCode },
        components: [
          {
            type: "body",
            parameters: bodyParams.map((text) => ({ type: "text", text: String(text).slice(0, 1024) })),
          },
        ],
      },
    };

    const url = `${META_API_BASE}/${creds.credentials.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.credentials.accessToken}`,
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
