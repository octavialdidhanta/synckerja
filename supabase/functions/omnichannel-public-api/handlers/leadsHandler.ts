import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { OmnichannelApiTokenContext } from "../../_shared/omnichannelPublicApi/auth.ts";
import { isUuid } from "../../_shared/omnichannelPublicApi/auth.ts";
import {
  getOrCreateSystemActor,
  resolveLeadStatusId,
} from "../../_shared/omnichannelPublicApi/leadStatusMap.ts";
import {
  normalizeEmail,
  normalizePhone,
} from "../../_shared/omnichannelPublicApi/phoneNormalize.ts";
import { apiError, apiSuccess } from "../../_shared/omnichannelPublicApi/response.ts";
import { resolveSessionMarketingAttribution } from "../../_shared/omnichannelPublicApi/urlParams.ts";
import { leadFbclidCapturePatch } from "../../_shared/fbclidCapture.ts";
import {
  findFloatingStubLead,
} from "../../_shared/omnichannelPublicApi/syncFloatingWaClickToLead.ts";
import { extractLeadFormPayload } from "../../_shared/omnichannelPublicApi/leadFormData.ts";
import {
  deriveApiLeadCrmFields,
  extractLeadFormOverrides,
} from "../../_shared/omnichannelPublicApi/apiLeadCrmFields.ts";
import {
  parseLeadConsent,
  triggerLeadWhatsApp,
  type LeadWhatsAppDebugInfo,
} from "../../_shared/omnichannelPublicApi/triggerLeadWhatsApp.ts";
import {
  persistLeadWhatsAppThread,
} from "../../_shared/omnichannelPublicApi/persistLeadWhatsAppThread.ts";
import { buildLeadWhatsAppStoredBody } from "../../_shared/omnichannelPublicApi/leadWhatsAppTemplatePreview.ts";
import { resolveOrganizationWhatsAppCredentials } from "../../_shared/omnichannelPublicApi/resolveOrganizationWhatsAppCredentials.ts";

function resolveFormId(body: Record<string, unknown>, formData: Record<string, unknown> | null): string | null {
  const top = body.form_id != null ? String(body.form_id).trim() : "";
  if (top) return top;
  const nested = formData?.form_id != null ? String(formData.form_id).trim() : "";
  return nested || null;
}

export async function handleLeads(
  admin: SupabaseClient,
  ctx: OmnichannelApiTokenContext,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  try {
    const extracted = extractLeadFormPayload(body);
    if (!extracted.ok) {
      return apiError(extracted.error, "VALIDATION_ERROR", 422, corsHeaders);
    }

    const { core, formData } = extracted;
    const name = core.name;
    const phoneRaw = core.phone_number ? normalizePhone(core.phone_number) : "";
    const emailRaw = core.email ? normalizeEmail(core.email) : "";
    const notes = core.notes;
    const sessionId = core.session_id;
    const formId = resolveFormId(body, formData);

    if (!name) {
      return apiError("name wajib diisi.", "VALIDATION_ERROR", 422, corsHeaders);
    }
    if (!phoneRaw && !emailRaw) {
      return apiError("Minimal salah satu dari phone_number atau email wajib diisi.", "VALIDATION_ERROR", 422, corsHeaders);
    }

    let attribution: Record<string, unknown> | null = null;
    let attributionLabel: string | null = null;
    let gclid: string | null = null;
    let fbclid: string | null = null;
    let sessionCapturedAt: string | null = null;

    if (sessionId && isUuid(sessionId)) {
      const { data: session } = await admin
        .from("analytics_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("web_id", ctx.webId)
        .maybeSingle();

      if (session) {
        const marketing = resolveSessionMarketingAttribution(sessionId, ctx.webId, session);
        attribution = marketing.attribution;
        attributionLabel = marketing.attributionLabel;
        gclid = marketing.gclid;
        fbclid = marketing.fbclid;
        sessionCapturedAt = session.fbclid_captured_at != null
          ? String(session.fbclid_captured_at)
          : null;
      }
    }

    const actor = await getOrCreateSystemActor(admin, ctx.organizationId);
    const statusId = await resolveLeadStatusId(
      admin,
      ctx.organizationId,
      core.status ?? "new",
    );

    const crmFields = deriveApiLeadCrmFields({
      webId: ctx.webId,
      channel: "website_form",
      overrides: extractLeadFormOverrides(body),
      formData,
      notes,
      attribution,
    });

    const now = new Date().toISOString();
    let leadId: string;

    const floatingStub =
      sessionId && isUuid(sessionId)
        ? await findFloatingStubLead(admin, ctx.organizationId, ctx.webId, sessionId)
        : null;

    if (floatingStub) {
      leadId = floatingStub.leadId;

      const leadPatch: Record<string, unknown> = {
        client: name,
        title: crmFields.title,
        category: crmFields.category,
        source: crmFields.source,
        created_by_name: crmFields.created_by_name,
        phone_number: phoneRaw || null,
        email: emailRaw || null,
        status_id: statusId,
        updated_at: now,
      };
      if (attribution) {
        const { data: stubLead } = await admin
          .from("leads")
          .select("fbclid, fbclid_captured_at, attribution")
          .eq("id", leadId)
          .maybeSingle();

        const fbCapture = leadFbclidCapturePatch({
          existingFbclid: stubLead?.fbclid != null ? String(stubLead.fbclid) : null,
          existingCapturedAt: stubLead?.fbclid_captured_at != null
            ? String(stubLead.fbclid_captured_at)
            : null,
          existingAttribution: stubLead?.attribution ?? attribution,
          incomingFbclid: fbclid,
          sessionCapturedAt,
          nowIso: now,
        });

        leadPatch.attribution = fbCapture.attribution ?? attribution;
        leadPatch.attribution_label = attributionLabel;
        leadPatch.gclid = gclid;
        leadPatch.fbclid = fbCapture.fbclid ?? fbclid;
        if (fbCapture.fbclid_captured_at) {
          leadPatch.fbclid_captured_at = fbCapture.fbclid_captured_at;
        }
      }

      const { error: leadUpdErr } = await admin
        .from("leads")
        .update(leadPatch)
        .eq("id", leadId)
        .eq("organization_id", ctx.organizationId);

      if (leadUpdErr) {
        console.error("handleLeads upgrade floating stub:", leadUpdErr);
        return apiError("Gagal memperbarui lead.", "INTERNAL_ERROR", 500, corsHeaders, leadUpdErr.message);
      }

      if (floatingStub.submissionId) {
        const { error: subUpdErr } = await admin
          .from("lead_submissions")
          .update({
            form_id: formId,
            name,
            phone_number: phoneRaw || null,
            email: emailRaw || null,
            notes,
            form_data: formData,
            status: "submitted",
            submitted_at: now,
            updated_at: now,
          })
          .eq("id", floatingStub.submissionId)
          .eq("organization_id", ctx.organizationId);

        if (subUpdErr) {
          console.error("handleLeads upgrade floating submission:", subUpdErr);
          return apiError("Gagal memperbarui profil lead.", "INTERNAL_ERROR", 500, corsHeaders, subUpdErr.message);
        }
      } else {
        const { error: subInsErr } = await admin.from("lead_submissions").insert({
          organization_id: ctx.organizationId,
          lead_id: leadId,
          web_id: ctx.webId,
          form_id: formId,
          name,
          phone_number: phoneRaw || null,
          email: emailRaw || null,
          notes,
          form_data: formData,
          status: "submitted",
          is_active: true,
          submitted_at: now,
          updated_at: now,
        });

        if (subInsErr) {
          console.error("handleLeads insert submission after stub:", subInsErr);
          return apiError("Gagal menyimpan profil lead.", "INTERNAL_ERROR", 500, corsHeaders, subInsErr.message);
        }
      }
    } else {
      leadId = crypto.randomUUID();

      const fbCapture = leadFbclidCapturePatch({
        existingFbclid: null,
        existingCapturedAt: null,
        existingAttribution: attribution,
        incomingFbclid: fbclid,
        sessionCapturedAt,
        nowIso: now,
      });

      const { error: leadErr } = await admin.from("leads").insert({
        id: leadId,
        client: name,
        title: crmFields.title,
        category: crmFields.category,
        created_by: actor.userId,
        created_by_name: crmFields.created_by_name,
        assignee: "Unassigned",
        organization_id: ctx.organizationId,
        source: crmFields.source,
        status_id: statusId,
        phone_number: phoneRaw || null,
        email: emailRaw || null,
        attribution: fbCapture.attribution ?? attribution,
        attribution_label: attributionLabel,
        web_id: ctx.webId,
        analytics_session_id: sessionId && isUuid(sessionId) ? sessionId : null,
        gclid,
        fbclid: fbCapture.fbclid ?? fbclid,
        fbclid_captured_at: fbCapture.fbclid_captured_at,
        created_at: now,
        updated_at: now,
      });

      if (leadErr) {
        console.error("handleLeads insert leads:", leadErr);
        return apiError("Gagal menyimpan lead.", "INTERNAL_ERROR", 500, corsHeaders, leadErr.message);
      }

      const { error: subErr } = await admin.from("lead_submissions").insert({
        organization_id: ctx.organizationId,
        lead_id: leadId,
        web_id: ctx.webId,
        form_id: formId,
        name,
        phone_number: phoneRaw || null,
        email: emailRaw || null,
        notes,
        form_data: formData,
        status: "submitted",
        is_active: true,
        submitted_at: now,
        updated_at: now,
      });

      if (subErr) {
        console.error("handleLeads insert lead_submissions:", subErr);
        await admin.from("leads").delete().eq("id", leadId);
        return apiError("Gagal menyimpan profil lead.", "INTERNAL_ERROR", 500, corsHeaders, subErr.message);
      }
    }

    let whatsappStatus: "pending" | "sent" | "failed" | "skipped" = "skipped";
    let whatsappMessageId: string | null = null;
    let whatsappSkipReason: string | null = null;
    let whatsappConversationId: string | null = null;
    let whatsappDebug: LeadWhatsAppDebugInfo | null = null;

    const hasConsent = parseLeadConsent(body, formData);

    const { data: orgSettings } = await admin
      .from("organization_omnichannel_api_settings")
      .select("default_whatsapp_lead_template_name, default_whatsapp_lead_template_language")
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();

    const templateName =
      ctx.whatsappLeadTemplateName ??
      orgSettings?.default_whatsapp_lead_template_name ??
      null;

    const orgTemplateLanguage = orgSettings?.default_whatsapp_lead_template_language ?? null;

    if (!hasConsent) {
      whatsappStatus = "skipped";
      whatsappSkipReason = "no_consent";
    } else if (!phoneRaw) {
      whatsappStatus = "skipped";
      whatsappSkipReason = "no_phone";
    } else if (!templateName) {
      whatsappStatus = "skipped";
      whatsappSkipReason = "no_template";
    } else {
      const waResult = await triggerLeadWhatsApp(admin, {
        organizationId: ctx.organizationId,
        webId: ctx.webId,
        templateName,
        orgTemplateLanguage,
        phoneNumber: phoneRaw,
        name,
        email: emailRaw || null,
        formData,
      });
      whatsappStatus = waResult.status;
      whatsappMessageId = waResult.messageId;
      whatsappSkipReason = waResult.skipReason ?? null;
      if (waResult.status === "failed" && waResult.debug) {
        whatsappDebug = waResult.debug;
      } else if (waResult.status === "skipped" && waResult.debug) {
        whatsappDebug = waResult.debug;
      }

      if (waResult.status === "failed") {
        console.error("handleLeads WhatsApp failed:", {
          lead_id: leadId,
          organization_id: ctx.organizationId,
          web_id: ctx.webId,
          template_name: templateName,
          mapping_source: waResult.mappingSource,
          param_count: waResult.paramCount,
          meta_error_code: waResult.metaErrorCode,
          error: waResult.error,
        });
      } else if (waResult.status === "sent" && waResult.messageId) {
        const creds = await resolveOrganizationWhatsAppCredentials(admin, ctx.organizationId, {
          webId: ctx.webId,
        });
        if (creds.ok) {
          const templateLanguage = waResult.templateLanguage ?? orgTemplateLanguage ?? "id";
          const bodyPreview = await buildLeadWhatsAppStoredBody(admin, {
            organizationId: ctx.organizationId,
            whatsappAccountId: creds.credentials.whatsappAccountId,
            phoneNumberId: creds.credentials.phoneNumberId,
            accessToken: creds.credentials.accessToken,
            templateName,
            templateLanguage,
            bodyParams: waResult.bodyParams ?? [],
          });
          const persisted = await persistLeadWhatsAppThread(admin, {
            organizationId: ctx.organizationId,
            leadId,
            webId: ctx.webId,
            phoneNumber: phoneRaw,
            customerName: name,
            waMessageId: waResult.messageId,
            templateName,
            templateLanguage,
            bodyPreview,
            bodyParams: waResult.bodyParams ?? [],
            rawMetadata: waResult.rawMetadata ?? null,
            whatsappAccountId: creds.credentials.whatsappAccountId,
            phoneNumberId: creds.credentials.phoneNumberId,
          });
          if (persisted.ok) {
            whatsappConversationId = persisted.conversationId;
          } else {
            console.error("handleLeads persistLeadWhatsAppThread failed:", persisted.error);
            whatsappSkipReason = `persist_failed:${persisted.error}`.slice(0, 500);
          }
        } else {
          console.error("handleLeads persist skipped — WA credentials:", creds.error);
          whatsappSkipReason = "persist_failed:wa_not_configured";
        }
      }
    }

    const waSentAt = whatsappStatus === "sent" ? new Date().toISOString() : null;

    await admin
      .from("lead_submissions")
      .update({
        whatsapp_status: whatsappStatus,
        whatsapp_message_id: whatsappMessageId,
        whatsapp_skip_reason: whatsappSkipReason,
        whatsapp_sent_at: waSentAt,
        whatsapp_conversation_id: whatsappConversationId,
        updated_at: new Date().toISOString(),
      })
      .eq("lead_id", leadId)
      .eq("organization_id", ctx.organizationId);

    const { data: ticketRow } = await admin.from("leads").select("ticket_id").eq("id", leadId).single();
    const finalTicketId = ticketRow?.ticket_id ?? null;

    const responseBody: Record<string, unknown> = {
        lead_id: leadId,
        ticket_id: finalTicketId,
        whatsapp_ticket_id: finalTicketId,
        session_id: sessionId,
        attribution,
        whatsapp_status: whatsappStatus,
        whatsapp_message_id: whatsappMessageId,
        whatsapp_skip_reason: whatsappSkipReason,
        whatsapp_conversation_id: whatsappConversationId,
      };

    if (whatsappStatus === "failed" && whatsappDebug) {
      responseBody.whatsapp_debug = whatsappDebug;
    } else if (whatsappStatus === "skipped" && whatsappDebug) {
      responseBody.whatsapp_debug = whatsappDebug;
    }

    return apiSuccess(responseBody, 201, corsHeaders);
  } catch (e) {
    console.error("handleLeads:", e);
    return apiError("Kesalahan server saat menyimpan lead.", "INTERNAL_ERROR", 500, corsHeaders);
  }
}

export async function findLeadByPhoneAndEmail(
  admin: SupabaseClient,
  organizationId: string,
  phone: string,
  email: string,
): Promise<string | null> {
  const normPhone = normalizePhone(phone);
  const normEmail = normalizeEmail(email);
  if (!normPhone || !normEmail) return null;

  const { data: submissions } = await admin
    .from("lead_submissions")
    .select("lead_id, phone_number, email, submitted_at")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .ilike("email", normEmail)
    .order("submitted_at", { ascending: false });

  for (const row of submissions ?? []) {
    if (normalizePhone(row.phone_number) === normPhone && row.lead_id) {
      return String(row.lead_id);
    }
  }

  const { data: leads } = await admin
    .from("leads")
    .select("id, phone_number, email, created_at")
    .eq("organization_id", organizationId)
    .ilike("email", normEmail)
    .order("created_at", { ascending: false });

  for (const row of leads ?? []) {
    if (normalizePhone(row.phone_number) === normPhone) {
      return String(row.id);
    }
  }

  return null;
}
