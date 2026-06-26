import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { OmnichannelApiTokenContext } from "../../_shared/omnichannelPublicApi/auth.ts";
import { kickOfflineConversionsServer } from "../../_shared/omnichannelPublicApi/kickOfflineConversions.ts";
import { createLeadConversionSalesActivity } from "../../_shared/omnichannelPublicApi/createLeadConversionSalesActivity.ts";
import {
  getOrCreateSystemActor,
  resolveConvertedStatusId,
} from "../../_shared/omnichannelPublicApi/leadStatusMap.ts";
import {
  normalizeEmail,
  normalizePhone,
} from "../../_shared/omnichannelPublicApi/phoneNormalize.ts";
import { apiError, apiSuccess } from "../../_shared/omnichannelPublicApi/response.ts";
import { findLeadByPhoneAndEmail } from "./leadsHandler.ts";
import { triggerInvoiceWhatsApp } from "../../_shared/omnichannelPublicApi/triggerInvoiceWhatsApp.ts";

export async function handleInvoiceTrigger(
  admin: SupabaseClient,
  ctx: OmnichannelApiTokenContext,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<Response> {
  try {
    const invoiceNumber = String(body.invoice_number ?? "").trim();
    const amount = Number(body.amount);
    const phoneRaw = String(body.phone_number ?? "").trim();
    const emailRaw = String(body.email ?? "").trim();
    const customerName = body.customer_name != null ? String(body.customer_name).trim() : null;
    const items = body.items;

    if (!invoiceNumber) {
      return apiError("invoice_number wajib diisi.", "VALIDATION_ERROR", 422, corsHeaders);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return apiError("amount harus angka positif.", "VALIDATION_ERROR", 422, corsHeaders);
    }
    if (!phoneRaw || !emailRaw) {
      return apiError("phone_number dan email wajib diisi untuk pencocokan lead.", "VALIDATION_ERROR", 422, corsHeaders);
    }
    if (!Array.isArray(items) || items.length === 0) {
      return apiError("items harus array JSON tidak kosong.", "VALIDATION_ERROR", 422, corsHeaders);
    }

    const { data: existing } = await admin
      .from("sales_invoices")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("invoice_number", invoiceNumber)
      .maybeSingle();

    if (existing?.id) {
      return apiError("Nomor invoice sudah terdaftar.", "CONFLICT", 409, corsHeaders, {
        invoice_number: invoiceNumber,
      });
    }

    const leadId = await findLeadByPhoneAndEmail(admin, ctx.organizationId, phoneRaw, emailRaw);

    const invoiceId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error: insertErr } = await admin.from("sales_invoices").insert({
      id: invoiceId,
      organization_id: ctx.organizationId,
      web_id: ctx.webId,
      lead_id: leadId,
      invoice_number: invoiceNumber,
      amount,
      items,
      whatsapp_status: "pending",
      customer_phone: normalizePhone(phoneRaw),
      customer_email: normalizeEmail(emailRaw),
      created_at: now,
      updated_at: now,
    });

    if (insertErr) {
      console.error("handleInvoiceTrigger insert:", insertErr);
      return apiError("Gagal menyimpan invoice.", "INTERNAL_ERROR", 500, corsHeaders, insertErr.message);
    }

    let converted = false;
    let salesActivityId: string | null = null;
    if (leadId) {
      const convertedStatusId = await resolveConvertedStatusId(admin, ctx.organizationId);
      if (convertedStatusId) {
        const { error: leadUpdErr } = await admin
          .from("leads")
          .update({
            status_id: convertedStatusId,
            converted_at: now,
            updated_at: now,
          })
          .eq("id", leadId)
          .eq("organization_id", ctx.organizationId);

        if (!leadUpdErr) {
          converted = true;

          const { data: leadRow } = await admin
            .from("leads")
            .select("client")
            .eq("id", leadId)
            .maybeSingle();

          const actor = await getOrCreateSystemActor(admin, ctx.organizationId);
          salesActivityId = await createLeadConversionSalesActivity(admin, {
            organizationId: ctx.organizationId,
            leadId,
            clientName: customerName ?? leadRow?.client ?? "Lead",
            clientPhone: normalizePhone(phoneRaw),
            clientEmail: normalizeEmail(emailRaw),
            createdByUserId: actor.userId,
            totalAmount: amount,
            items: items as unknown[],
            invoiceNumber,
          });

          const { data: settings } = await admin
            .from("organization_omnichannel_api_settings")
            .select("offline_conversion_enabled")
            .eq("organization_id", ctx.organizationId)
            .maybeSingle();

          const offlineEnabled = settings?.offline_conversion_enabled !== false;
          if (offlineEnabled) {
            kickOfflineConversionsServer({
              supabaseUrl,
              serviceRoleKey,
              organizationId: ctx.organizationId,
              leadId,
              salesActivityId,
            });
          }
        }
      }
    }

    let whatsappStatus = "pending";
    let whatsappMessageId: string | null = null;

    const { data: orgSettings } = await admin
      .from("organization_omnichannel_api_settings")
      .select("default_whatsapp_invoice_template_name, default_whatsapp_invoice_template_language")
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();

    const templateName =
      ctx.whatsappInvoiceTemplateName ??
      orgSettings?.default_whatsapp_invoice_template_name ??
      null;

    const templateLanguage = orgSettings?.default_whatsapp_invoice_template_language ?? null;

    if (templateName && phoneRaw) {
      const waResult = await triggerInvoiceWhatsApp(admin, {
        organizationId: ctx.organizationId,
        webId: ctx.webId,
        templateName,
        templateLanguage,
        phoneNumber: phoneRaw,
        invoiceNumber,
        amount,
        customerName,
        items,
      });
      whatsappStatus = waResult.status;
      whatsappMessageId = waResult.messageId;

      await admin
        .from("sales_invoices")
        .update({
          whatsapp_status: whatsappStatus,
          whatsapp_message_id: whatsappMessageId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);
    }

    return apiSuccess(
      {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        lead_id: leadId,
        lead_matched: Boolean(leadId),
        lead_converted: converted,
        sales_activity_id: salesActivityId,
        whatsapp_status: whatsappStatus,
        whatsapp_message_id: whatsappMessageId,
      },
      201,
      corsHeaders,
    );
  } catch (e) {
    console.error("handleInvoiceTrigger:", e);
    return apiError("Kesalahan server saat memproses invoice.", "INTERNAL_ERROR", 500, corsHeaders);
  }
}
