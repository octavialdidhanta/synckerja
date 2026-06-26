import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isOmnichannelApiTokenExpired } from "./auth.ts";
import {
  aggregateMapperFormDataKeys,
  extractNonEmptyFormDataKeys,
  isMapperRelevantSubmission,
} from "./leadFormDataKeys.ts";
import {
  buildPreviewParamsFromMapping,
  parseParameterMapping,
  resolveBodyKeyValue,
  suggestLeadParameterMapping,
  validateParameterMappingForSlots,
} from "./leadTemplateMapping.ts";
import {
  fetchLeadTemplateBodySlotCount,
  resolveWabaIdForOrg,
} from "./leadWhatsAppTemplateSlots.ts";
import {
  fetchMetaTemplateComponents,
  renderFilledBodyTemplateText,
} from "./leadWhatsAppTemplatePreview.ts";
import { resolveOrganizationWhatsAppCredentials } from "./resolveOrganizationWhatsAppCredentials.ts";
import { normalizeWebId } from "./urlParams.ts";

type ManageJson = (body: unknown, status?: number) => Response;

function normalizeTemplateLanguage(value: unknown): string {
  const trimmed = String(value ?? "id").trim();
  return trimmed || "id";
}

async function fetchTemplateBodySlotCount(
  admin: SupabaseClient,
  organizationId: string,
  templateName: string,
  templateLanguage: string,
  webId?: string,
): Promise<{ ok: true; slotCount: number } | { ok: false; error: string }> {
  return fetchLeadTemplateBodySlotCount(
    admin,
    organizationId,
    templateName,
    templateLanguage,
    webId,
  );
}

async function resolveWabaId(
  admin: SupabaseClient,
  organizationId: string,
  credentials: { whatsappAccountId: string; phoneNumberId: string; accessToken: string },
): Promise<string | null> {
  return resolveWabaIdForOrg(admin, organizationId, credentials);
}

const MAPPER_SUBMISSION_LOOKBACK_DAYS = 30;
const MAPPER_SUBMISSION_FETCH_LIMIT = 30;

async function fetchMapperFormSubmissions(
  admin: SupabaseClient,
  organizationId: string,
  webId: string,
) {
  const since = new Date();
  since.setDate(since.getDate() - MAPPER_SUBMISSION_LOOKBACK_DAYS);

  const { data, error } = await admin
    .from("lead_submissions")
    .select("id, name, email, phone_number, notes, form_data, form_id, status, submitted_at")
    .eq("organization_id", organizationId)
    .eq("web_id", webId)
    .eq("status", "submitted")
    .gte("submitted_at", since.toISOString())
    .order("submitted_at", { ascending: false })
    .limit(MAPPER_SUBMISSION_FETCH_LIMIT);

  if (error) throw error;

  return (data ?? []).filter((row) => isMapperRelevantSubmission(row));
}

export async function handleLeadTemplateMappingAction(
  admin: SupabaseClient,
  body: Record<string, unknown>,
  organizationId: string,
  json: ManageJson,
): Promise<Response | null> {
  const action = String(body.action ?? "").trim();

  if (action === "listLeadMappingWebIds") {
    const { data, error } = await admin
      .from("organization_omnichannel_api_tokens")
      .select("web_id, is_active, expires_at")
      .eq("organization_id", organizationId);

    if (error) return json({ success: false, error: error.message }, 500);

    const webIds = new Set<string>();
    for (const row of data ?? []) {
      if (!row.is_active) continue;
      if (isOmnichannelApiTokenExpired(row.expires_at as string | null)) continue;
      const wid = normalizeWebId(String(row.web_id ?? ""));
      if (wid) webIds.add(wid);
    }

    return json({ success: true, web_ids: [...webIds].sort() });
  }

  if (action === "getLeadTemplateMapping") {
    const webId = normalizeWebId(String(body.web_id ?? ""));
    const templateName = String(body.template_name ?? "").trim();
    const templateLanguage = normalizeTemplateLanguage(body.template_language);

    if (!webId || !templateName) {
      return json({ success: false, error: "web_id dan template_name wajib." }, 400);
    }

    const { data, error } = await admin
      .from("organization_whatsapp_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("web_id", webId)
      .eq("purpose", "lead")
      .eq("template_name", templateName)
      .eq("template_language", templateLanguage)
      .maybeSingle();

    if (error) return json({ success: false, error: error.message }, 500);

    return json({
      success: true,
      mapping: data ?? null,
    });
  }

  if (action === "getRecentLeadFormDataKeys") {
    const webId = normalizeWebId(String(body.web_id ?? ""));
    if (!webId) return json({ success: false, error: "web_id wajib." }, 400);

    try {
      const rows = await fetchMapperFormSubmissions(admin, organizationId, webId);
      const keys = aggregateMapperFormDataKeys(rows);
      return json({ success: true, keys });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memuat field form.";
      return json({ success: false, error: message }, 500);
    }
  }

  if (action === "getLatestLeadSubmissionForPreview") {
    const webId = normalizeWebId(String(body.web_id ?? ""));
    if (!webId) return json({ success: false, error: "web_id wajib." }, 400);

    try {
      const rows = await fetchMapperFormSubmissions(admin, organizationId, webId);
      const submission = rows[0] ?? null;
      return json({
        success: true,
        submission: submission
          ? {
            id: submission.id,
            name: submission.name,
            email: submission.email,
            phone_number: submission.phone_number,
            notes: submission.notes,
            form_data: submission.form_data,
            submitted_at: submission.submitted_at,
          }
          : null,
        form_data_keys: aggregateMapperFormDataKeys(rows),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memuat submission.";
      return json({ success: false, error: message }, 500);
    }
  }

  if (action === "upsertLeadTemplateMapping") {
    const webId = normalizeWebId(String(body.web_id ?? ""));
    const templateName = String(body.template_name ?? "").trim();
    const templateLanguage = normalizeTemplateLanguage(body.template_language);
    const parameterMapping = body.parameter_mapping as Record<string, string> | null;

    if (!webId || !templateName) {
      return json({ success: false, error: "web_id dan template_name wajib." }, 400);
    }
    if (!parameterMapping || typeof parameterMapping !== "object") {
      return json({ success: false, error: "parameter_mapping wajib (objek slot → field)." }, 400);
    }

    const slots = await fetchTemplateBodySlotCount(
      admin,
      organizationId,
      templateName,
      templateLanguage,
      webId,
    );
    if (!slots.ok) return json({ success: false, error: slots.error }, 422);

    const validationError = validateParameterMappingForSlots(parameterMapping, slots.slotCount);
    if (validationError) {
      return json({ success: false, error: validationError }, 422);
    }

    const now = new Date().toISOString();
    const patch = {
      organization_id: organizationId,
      web_id: webId,
      purpose: "lead",
      template_name: templateName,
      template_language: templateLanguage,
      parameter_mapping: parameterMapping,
      is_active: true,
      updated_at: now,
    };

    const { data, error } = await admin
      .from("organization_whatsapp_templates")
      .upsert(patch, {
        onConflict: "organization_id,web_id,purpose,template_name,template_language",
      })
      .select("*")
      .single();

    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, mapping: data, slot_count: slots.slotCount });
  }

  if (action === "previewLeadTemplateMapping") {
    const webId = normalizeWebId(String(body.web_id ?? ""));
    const templateName = String(body.template_name ?? "").trim();
    const templateLanguage = normalizeTemplateLanguage(body.template_language);
    const parameterMapping = body.parameter_mapping as Record<string, string> | null;
    const submissionId = body.lead_submission_id != null
      ? String(body.lead_submission_id).trim()
      : null;

    if (!webId || !templateName) {
      return json({ success: false, error: "web_id dan template_name wajib." }, 400);
    }
    if (!parameterMapping || typeof parameterMapping !== "object") {
      return json({ success: false, error: "parameter_mapping wajib." }, 400);
    }

    const bodyKeys = parseParameterMapping(parameterMapping);
    if (!bodyKeys) {
      return json({ success: false, error: "parameter_mapping tidak valid." }, 422);
    }

    const { data: submissionRows, error: subErr } = submissionId
      ? await admin
        .from("lead_submissions")
        .select("id, name, email, phone_number, notes, form_data, submitted_at")
        .eq("organization_id", organizationId)
        .eq("id", submissionId)
        .limit(1)
      : await admin
        .from("lead_submissions")
        .select("id, name, email, phone_number, notes, form_data, submitted_at")
        .eq("organization_id", organizationId)
        .eq("web_id", webId)
        .order("submitted_at", { ascending: false })
        .limit(1);

    if (subErr) return json({ success: false, error: subErr.message }, 500);

    const submission = (submissionRows ?? [])[0] ?? null;

    const sample = submission ?? {
      name: "Budi Santoso",
      email: "budi@example.com",
      phone_number: "6281234567890",
      notes: null,
      form_data: {
        package_label: "Paket Gold",
        event_date: "2026-12-01",
        event_time: "10:00",
        event_address: "Jakarta",
      },
    };

    const formData = (sample.form_data ?? null) as Record<string, unknown> | null;
    const leadArgs = {
      name: String(sample.name ?? ""),
      email: sample.email != null ? String(sample.email) : null,
      phoneNumber: String(sample.phone_number ?? ""),
      notes: sample.notes != null ? String(sample.notes) : null,
      formData,
    };
    const bodyParams = buildPreviewParamsFromMapping(bodyKeys, leadArgs);

    let previewText = bodyParams.filter((p) => p !== "-").join(" · ");
    const creds = await resolveOrganizationWhatsAppCredentials(admin, organizationId, { webId });
    if (creds.ok && templateName) {
      const wabaId = await resolveWabaId(admin, organizationId, creds.credentials);
      if (wabaId) {
        const components = await fetchMetaTemplateComponents(
          wabaId,
          creds.credentials.accessToken,
          templateName,
          templateLanguage,
        );
        if (components) {
          previewText = renderFilledBodyTemplateText(components, bodyParams);
        }
      }
    }

    const usedSampleFallback = Boolean(
      submission &&
        bodyKeys.some((key) => resolveBodyKeyValue(key, leadArgs) === "-"),
    );

    return json({
      success: true,
      body_params: bodyParams,
      preview_text: previewText,
      submission: submission
        ? {
          id: submission.id,
          submitted_at: submission.submitted_at,
        }
        : null,
      used_sample: !submission || usedSampleFallback,
    });
  }

  if (action === "suggestLeadTemplateMapping") {
    const webId = normalizeWebId(String(body.web_id ?? ""));
    const templateName = String(body.template_name ?? "").trim();
    const templateLanguage = normalizeTemplateLanguage(body.template_language);

    if (!webId || !templateName) {
      return json({ success: false, error: "web_id dan template_name wajib." }, 400);
    }

    const slots = await fetchTemplateBodySlotCount(
      admin,
      organizationId,
      templateName,
      templateLanguage,
      webId,
    );
    if (!slots.ok) return json({ success: false, error: slots.error }, 422);

    const rows = await fetchMapperFormSubmissions(admin, organizationId, webId);
    const recentKeys = aggregateMapperFormDataKeys(rows);

    const parameter_mapping = suggestLeadParameterMapping(
      slots.slotCount,
      recentKeys,
    );

    return json({
      success: true,
      parameter_mapping,
      slot_count: slots.slotCount,
    });
  }

  return null;
}
