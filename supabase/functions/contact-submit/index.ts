/**
 * Hub Edge: contact-submit — generic multi-step form for all properties.
 */
import { attributionToJsonb, parseLeadAttribution } from "../_shared/attribution.ts";
import { corsPreflightHeaders, jsonResponse } from "../_shared/cors.ts";
import { patchCrmLeadFromStep1, syncCrmLeadStep1, updateCrmLeadFromSubmission } from "../_shared/crmLeadSync.ts";
import { runPostSubmitWhatsAppForSubmission } from "../_shared/postSubmitWhatsApp.ts";
import { applyCrmMapping } from "../_shared/extractDenormalized.ts";
import { clientIpFromRequest, rateLimitByWebId } from "../_shared/rateLimitByWebId.ts";
import { resolveActiveProperty } from "../_shared/resolveWebId.ts";
import { resolveGclidForEvent } from "../_shared/gclid.ts";
import {
  buildLeadTitleFromPackage,
  resolvePropertyPackage,
} from "../_shared/resolvePropertyPackage.ts";
import { createServiceClient, mustGetEnv } from "../_shared/supabaseAdmin.ts";
import {
  getMaxStep,
  getStepFields,
  parseFormSchema,
  validateFormStep,
} from "../_shared/validateFormStep.ts";

type SubmitBody = {
  web_id: string;
  form_id: string;
  step: number;
  id?: string;
  form_data: Record<string, unknown>;
  package_label?: string;
  property_package_id?: string;
  attribution?: unknown;
  analytics_session_id?: string;
  gclid?: string | null;
};

function mergeFormData(
  existing: Record<string, unknown>,
  stepPatch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...existing, ...stepPatch };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsPreflightHeaders(origin) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 }, origin);
  }

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 }, origin);
  }

  const admin = createServiceClient();

  const resolved = await resolveActiveProperty(admin, body.web_id);
  if (!resolved.ok) {
    return jsonResponse({ error: resolved.error }, { status: resolved.status }, origin);
  }
  const property = resolved.property;

  const rl = await rateLimitByWebId(admin, property.slug, clientIpFromRequest(req));
  if (!rl.ok) {
    return jsonResponse(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      origin,
    );
  }

  const formId = typeof body.form_id === "string" ? body.form_id.trim() : "";
  if (!formId) {
    return jsonResponse({ error: "form_id required" }, { status: 400 }, origin);
  }

  const step = Number(body.step);
  if (!Number.isInteger(step) || step < 1) {
    return jsonResponse({ error: "Invalid step" }, { status: 400 }, origin);
  }

  const { data: formDef, error: formErr } = await admin
    .from("form_definitions")
    .select("id, version, schema, crm_mapping, is_active")
    .eq("web_id", property.slug)
    .eq("form_id", formId)
    .eq("is_active", true)
    .maybeSingle();

  if (formErr || !formDef) {
    return jsonResponse({ error: "Form not found" }, { status: 400 }, origin);
  }

  const schema = parseFormSchema(formDef.schema);
  if (!schema) {
    return jsonResponse({ error: "Invalid form schema" }, { status: 500 }, origin);
  }

  const fields = getStepFields(schema, step);
  if (!fields) {
    return jsonResponse({ error: "Invalid step for form" }, { status: 400 }, origin);
  }

  const formDataIn =
    body.form_data && typeof body.form_data === "object" && !Array.isArray(body.form_data)
      ? body.form_data
      : {};

  const validated = validateFormStep(fields, formDataIn);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, { status: 400 }, origin);
  }

  if (validated.honeypotTriggered) {
    return jsonResponse({ ok: true, submission_id: null, lead_id: null }, { status: 200 }, origin);
  }

  const maxStep = getMaxStep(schema);
  const isFinalStep = step >= maxStep;

  if (isFinalStep) {
    if (typeof body.analytics_session_id !== "string" || !body.analytics_session_id.trim()) {
      return jsonResponse(
        { error: "analytics_session_id required on final step" },
        { status: 400 },
        origin,
      );
    }
    if (body.attribution === undefined || body.attribution === null) {
      return jsonResponse({ error: "attribution required on final step" }, { status: 400 }, origin);
    }
    const parsedAttr = parseLeadAttribution(body.attribution);
    if (!parsedAttr) {
      return jsonResponse({ error: "Invalid attribution" }, { status: 400 }, origin);
    }
  }

  let systemUserId: string;
  try {
    systemUserId = mustGetEnv("SYSTEM_USER_ID");
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, { status: 500 }, origin);
  }

  const crmMapping = (formDef.crm_mapping ?? {}) as Record<string, unknown>;
  const submissionId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : undefined;

  let existingRow: Record<string, unknown> | null = null;
  if (submissionId) {
    const { data: row, error: loadErr } = await admin
      .from("lead_submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle();
    if (loadErr || !row) {
      return jsonResponse({ error: "Submission not found" }, { status: 400 }, origin);
    }
    if (String(row.web_id) !== property.slug || String(row.form_id) !== formId) {
      return jsonResponse({ error: "Submission not valid" }, { status: 400 }, origin);
    }
    existingRow = row as Record<string, unknown>;
  }

  const merged = mergeFormData(
    (existingRow?.form_data as Record<string, unknown>) ?? {},
    validated.sanitized,
  );

  const denorm = applyCrmMapping(merged, crmMapping);

  const bodyPackageId =
    typeof body.property_package_id === "string" && body.property_package_id.trim()
      ? body.property_package_id.trim()
      : null;
  const existingPackageId =
    typeof existingRow?.property_package_id === "string" && existingRow.property_package_id.trim()
      ? String(existingRow.property_package_id).trim()
      : null;
  const packageIdToResolve = bodyPackageId ?? existingPackageId;

  const resolvedPkg = packageIdToResolve
    ? await resolvePropertyPackage({
        admin,
        webId: property.slug,
        propertyPackageId: packageIdToResolve,
      })
    : null;

  if (bodyPackageId && !resolvedPkg) {
    return jsonResponse({ error: "Invalid property_package_id" }, { status: 400 }, origin);
  }

  const servicesLabel = resolvedPkg?.package_label ?? null;
  const legacySubmissionLabel =
    (typeof body.package_label === "string" && body.package_label.trim()) ||
    (typeof denorm.package_label === "string" && denorm.package_label.trim()) ||
    null;
  const submissionPackageLabel = servicesLabel ?? legacySubmissionLabel;
  const propertyPackageId = resolvedPkg?.id ?? existingPackageId ?? null;

  const CONTACT_PAGE_LEAD_TITLE = "Konsultasi umum — halaman kontak";
  const leadTitle = propertyPackageId
    ? buildLeadTitleFromPackage(resolvedPkg, property.slug)
    : CONTACT_PAGE_LEAD_TITLE;

  const parsedAttrFinal = isFinalStep ? parseLeadAttribution(body.attribution) : null;

  const sessionIdRaw =
    typeof body.analytics_session_id === "string" ? body.analytics_session_id.trim() : "";
  const resolvedGclid = sessionIdRaw
    ? await resolveGclidForEvent(admin, sessionIdRaw, body.gclid)
    : null;

  let leadId = typeof existingRow?.lead_id === "string" ? String(existingRow.lead_id) : null;
  let identityHash =
    typeof existingRow?.identity_hash === "string" ? String(existingRow.identity_hash) : null;

  const name = denorm.name ?? "";
  const phone = denorm.phone_number ?? "";
  const email = denorm.email ?? "";

  let draftLeadIdFromSession: string | null = leadId;
  if (
    step === 1 &&
    !draftLeadIdFromSession &&
    typeof body.analytics_session_id === "string" &&
    body.analytics_session_id.trim()
  ) {
    const { data: draftRow } = await admin
      .from("lead_submissions")
      .select("lead_id")
      .eq("web_id", property.slug)
      .eq("organization_id", property.organization_id)
      .eq("analytics_session_id", body.analytics_session_id.trim())
      .eq("form_id", formId)
      .eq("status", "draft")
      .maybeSingle();
    if (draftRow?.lead_id) {
      draftLeadIdFromSession = String(draftRow.lead_id);
    }
  }

  if (step === 1 && name && phone && email) {
    const crmAttribution = parsedAttrFinal ? attributionToJsonb(parsedAttrFinal.attribution) : null;
    const crmLabel = parsedAttrFinal?.label ?? null;
    const sessionId =
      typeof body.analytics_session_id === "string" ? body.analytics_session_id.trim() : null;

    if (draftLeadIdFromSession) {
      const patched = await patchCrmLeadFromStep1({
        admin,
        leadId: draftLeadIdFromSession,
        systemUserId,
        organizationId: property.organization_id,
        webId: property.slug,
        formId,
        name,
        phone_number: phone,
        email,
        leadTitle,
        servicesLabel,
        analytics_session_id: sessionId,
        attribution: crmAttribution,
        attribution_label: crmLabel,
        gclid: resolvedGclid,
      });
      if (!patched.ok) {
        return jsonResponse({ error: patched.error }, { status: 500 }, origin);
      }
      leadId = draftLeadIdFromSession;
      identityHash = patched.identityHash;
    } else {
      const crm = await syncCrmLeadStep1({
        admin,
        systemUserId,
        organizationId: property.organization_id,
        webId: property.slug,
        formId,
        name,
        phone_number: phone,
        email,
        leadTitle,
        servicesLabel,
        analytics_session_id: sessionId,
        attribution: crmAttribution,
        attribution_label: crmLabel,
        gclid: resolvedGclid,
        propertyDisplayName: property.display_name,
      });
      if (!crm.ok) {
        return jsonResponse({ error: crm.error }, { status: 500 }, origin);
      }
      leadId = crm.leadId;
      identityHash = crm.identityHash;
    }
  }

  const rowPatch: Record<string, unknown> = {
    web_id: property.slug,
    form_id: formId,
    form_version: formDef.version,
    step,
    form_data: merged,
    name: denorm.name,
    phone_number: denorm.phone_number,
    email: denorm.email,
    package_label: submissionPackageLabel,
    property_package_id: propertyPackageId,
    organization_id: property.organization_id,
    lead_id: leadId,
    identity_hash: identityHash,
    status: isFinalStep ? "submitted" : "draft",
    submitted_at: isFinalStep ? new Date().toISOString() : null,
    created_by: systemUserId,
  };

  if (isFinalStep) {
    rowPatch.analytics_session_id = body.analytics_session_id!.trim();
    if (parsedAttrFinal) {
      rowPatch.attribution = attributionToJsonb(parsedAttrFinal.attribution);
      rowPatch.attribution_label = parsedAttrFinal.label;
    }
  } else if (body.analytics_session_id) {
    rowPatch.analytics_session_id = body.analytics_session_id.trim();
  }
  if (resolvedGclid) {
    rowPatch.gclid = resolvedGclid;
  }

  let savedId: string;

  function isFinalDedupeError(err: { code?: string; message?: string } | null): boolean {
    if (!err) return false;
    if (err.code === "23505") return true;
    return /uq_lead_submissions_final_dedupe|duplicate key/i.test(err.message ?? "");
  }

  if (submissionId) {
    const { data: updated, error: upErr } = await admin
      .from("lead_submissions")
      .update(rowPatch)
      .eq("id", submissionId)
      .select("id, lead_id")
      .single();
    if (upErr || !updated) {
      if (isFinalStep && isFinalDedupeError(upErr)) {
        return jsonResponse(
          { error: "Lead sudah pernah dikirim untuk session ini" },
          { status: 400 },
          origin,
        );
      }
      return jsonResponse({ error: upErr?.message ?? "Update failed" }, { status: 500 }, origin);
    }
    savedId = String(updated.id);
    leadId = updated.lead_id ? String(updated.lead_id) : leadId;
  } else if (
    step === 1 &&
    rowPatch.analytics_session_id &&
    rowPatch.status === "draft"
  ) {
    // Partial unique index on step1_dedupe_key — PostgREST upsert(onConflict) is unsupported; use select → update | insert.
    const sessionId = String(rowPatch.analytics_session_id);
    const { data: existingDraft } = await admin
      .from("lead_submissions")
      .select("id, lead_id")
      .eq("web_id", property.slug)
      .eq("organization_id", property.organization_id)
      .eq("analytics_session_id", sessionId)
      .eq("form_id", formId)
      .eq("status", "draft")
      .eq("step", 1)
      .maybeSingle();

    if (existingDraft?.id) {
      const { data: updated, error: upErr } = await admin
        .from("lead_submissions")
        .update(rowPatch)
        .eq("id", existingDraft.id)
        .select("id, lead_id")
        .single();
      if (upErr || !updated) {
        return jsonResponse({ error: upErr?.message ?? "Update failed" }, { status: 500 }, origin);
      }
      savedId = String(updated.id);
      leadId = updated.lead_id ? String(updated.lead_id) : leadId;
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("lead_submissions")
        .insert(rowPatch)
        .select("id, lead_id")
        .single();
      if (insErr || !inserted) {
        if (insErr?.code === "23505") {
          const { data: raced } = await admin
            .from("lead_submissions")
            .select("id, lead_id")
            .eq("web_id", property.slug)
            .eq("organization_id", property.organization_id)
            .eq("analytics_session_id", sessionId)
            .eq("form_id", formId)
            .eq("status", "draft")
            .eq("step", 1)
            .maybeSingle();
          if (raced?.id) {
            const { data: updated, error: raceUpErr } = await admin
              .from("lead_submissions")
              .update(rowPatch)
              .eq("id", raced.id)
              .select("id, lead_id")
              .single();
            if (!raceUpErr && updated) {
              savedId = String(updated.id);
              leadId = updated.lead_id ? String(updated.lead_id) : leadId;
            } else {
              return jsonResponse(
                { error: raceUpErr?.message ?? insErr.message },
                { status: 500 },
                origin,
              );
            }
          } else {
            return jsonResponse({ error: insErr.message }, { status: 500 }, origin);
          }
        } else {
          return jsonResponse({ error: insErr?.message ?? "Insert failed" }, { status: 500 }, origin);
        }
      } else {
        savedId = String(inserted.id);
        leadId = inserted.lead_id ? String(inserted.lead_id) : leadId;
      }
    }
  } else {
    const { data: inserted, error: insErr } = await admin
      .from("lead_submissions")
      .insert(rowPatch)
      .select("id, lead_id")
      .single();
    if (insErr || !inserted) {
      return jsonResponse({ error: insErr?.message ?? "Insert failed" }, { status: 500 }, origin);
    }
    savedId = String(inserted.id);
    leadId = inserted.lead_id ? String(inserted.lead_id) : leadId;
  }

  if (isFinalStep && leadId) {
    await updateCrmLeadFromSubmission({
      admin,
      submissionId: savedId,
      leadId,
      organizationId: property.organization_id,
      webId: property.slug,
      formId,
      mergedFormData: merged,
      leadTitle,
      servicesLabel,
      attribution: parsedAttrFinal ? attributionToJsonb(parsedAttrFinal.attribution) : null,
      attribution_label: parsedAttrFinal?.label ?? null,
      analytics_session_id: body.analytics_session_id?.trim() ?? null,
      gclid: resolvedGclid,
    });
  }

  let whatsapp: Record<string, unknown> | undefined;
  if (isFinalStep && leadId && name && phone && email) {
    const wa = await runPostSubmitWhatsAppForSubmission({
      admin,
      organizationId: property.organization_id,
      webId: property.slug,
      formId,
      submissionId: savedId,
      leadId,
      name,
      email,
      phone_number: phone,
      package_label: submissionPackageLabel,
      mergedFormData: merged,
    });
    if (wa) whatsapp = wa;
  }

  return jsonResponse(
    { submission_id: savedId, lead_id: leadId, id: savedId, ...(whatsapp ? { whatsapp } : {}) },
    { status: 200 },
    origin,
  );
});
