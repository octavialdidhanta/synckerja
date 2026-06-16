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
import { buildAttributionLabel, resolveSessionClickIds } from "../../_shared/omnichannelPublicApi/urlParams.ts";
import { extractLeadFormPayload } from "../../_shared/omnichannelPublicApi/leadFormData.ts";

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
    const phoneRaw = core.phone_number;
    const emailRaw = core.email;
    const notes = core.notes;
    const sessionId = core.session_id;

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

    if (sessionId && isUuid(sessionId)) {
      const { data: session } = await admin
        .from("analytics_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("web_id", ctx.webId)
        .maybeSingle();

      if (session) {
        const clickIds = resolveSessionClickIds(session);
        const landingUrl = session.last_landing_url ?? session.landing_url ?? null;
        attribution = {
          session_id: sessionId,
          web_id: ctx.webId,
          utm_source: session.utm_source,
          utm_medium: session.utm_medium,
          utm_campaign: session.utm_campaign,
          utm_content: session.utm_content,
          utm_term: session.utm_term,
          landing_url: landingUrl,
          gclid: clickIds.gclid,
          fbclid: clickIds.fbclid,
        };
        attributionLabel = buildAttributionLabel({
          utm_source: session.utm_source,
          utm_medium: session.utm_medium,
          utm_campaign: session.utm_campaign,
          utm_term: session.utm_term,
          utm_content: session.utm_content,
          gclid: clickIds.gclid,
          fbclid: clickIds.fbclid,
          msclkid: null,
          gbraid: null,
          wbraid: null,
          path: "/",
        });
        gclid = clickIds.gclid;
        fbclid = clickIds.fbclid;
      }
    }

    const actor = await getOrCreateSystemActor(admin, ctx.organizationId);
    const statusId = await resolveLeadStatusId(
      admin,
      ctx.organizationId,
      core.status ?? "new",
    );

    const now = new Date().toISOString();
    const leadId = crypto.randomUUID();

    const { error: leadErr } = await admin.from("leads").insert({
      id: leadId,
      client: name,
      title: "Lead Website",
      category: "Website API",
      created_by: actor.userId,
      created_by_name: actor.displayName,
      assignee: "Unassigned",
      organization_id: ctx.organizationId,
      source: "Website",
      status_id: statusId,
      phone_number: phoneRaw || null,
      email: emailRaw || null,
      attribution,
      attribution_label: attributionLabel,
      web_id: ctx.webId,
      analytics_session_id: sessionId && isUuid(sessionId) ? sessionId : null,
      gclid,
      fbclid,
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
      form_id: null,
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

    const { data: ticketRow } = await admin.from("leads").select("ticket_id").eq("id", leadId).single();

    return apiSuccess(
      {
        lead_id: leadId,
        ticket_id: ticketRow?.ticket_id ?? null,
        session_id: sessionId,
        attribution,
      },
      201,
      corsHeaders,
    );
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
