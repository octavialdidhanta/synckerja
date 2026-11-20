/**
 * Legacy Edge `contact-lead` — adapter to hub `contact-submit`.
 * Maps wedding/agency body shapes to the stable hub contract.
 */
import { mustGetEnv } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, corsPreflightHeaders, jsonResponse } from "../_shared/cors.ts";

const CONTACT_DEFAULT_PACKAGE = "Konsultasi umum — halaman kontak";
const DEFAULT_WEB_ID = "vialdi-wedding";
const DEFAULT_FORM_ID = "contact-main";

type LegacyStep = 1 | 2 | 3;

function mapLegacyToHub(body: Record<string, unknown>): Record<string, unknown> {
  const step = Number(body.step) as LegacyStep;
  const webId =
    (typeof body.web_id === "string" && body.web_id.trim()) ||
    Deno.env.get("HUB_DEFAULT_WEB_ID") ||
    DEFAULT_WEB_ID;
  const formId =
    (typeof body.form_id === "string" && body.form_id.trim()) || DEFAULT_FORM_ID;

  const form_data: Record<string, unknown> = {};

  if (step === 1) {
    if (typeof body.name === "string") form_data.name = body.name;
    if (typeof body.phone_number === "string") form_data.phone_number = body.phone_number;
    if (typeof body.email === "string") form_data.email = body.email;
  } else if (step === 2) {
    if (typeof body.industry === "string") form_data.industry = body.industry;
    if (typeof body.business_type === "string") form_data.business_type = body.business_type;
    if (typeof body.event_date === "string") form_data.event_date = body.event_date;
    if (typeof body.event_time === "string") form_data.event_time = body.event_time;
    if (typeof body.event_address === "string") form_data.event_address = body.event_address;
    if (body.consent === true) form_data.consent = true;
  } else if (step === 3) {
    if (typeof body.job_title === "string") form_data.job_title = body.job_title;
    if (typeof body.needs === "string") form_data.needs = body.needs;
    if (typeof body.office_address === "string") form_data.office_address = body.office_address;
  }

  if (body.form_data && typeof body.form_data === "object" && !Array.isArray(body.form_data)) {
    Object.assign(form_data, body.form_data as Record<string, unknown>);
  }

  const out: Record<string, unknown> = {
    web_id: webId,
    form_id: formId,
    step,
    form_data,
  };

  if (typeof body.id === "string" && body.id.trim()) out.id = body.id.trim();

  const pkg = body.package_label;
  if (typeof pkg === "string" && pkg.trim()) {
    out.package_label = pkg.trim();
  } else if (step === 1 && webId === "vialdi-wedding") {
    out.package_label = CONTACT_DEFAULT_PACKAGE;
  }

  if (body.attribution !== undefined) out.attribution = body.attribution;
  if (typeof body.analytics_session_id === "string") {
    out.analytics_session_id = body.analytics_session_id;
  }
  if (typeof body.property_package_id === "string" && body.property_package_id.trim()) {
    out.property_package_id = body.property_package_id.trim();
  }

  return out;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsPreflightHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 }, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 }, origin);
  }

  const hubBody = mapLegacyToHub(body);

  let supabaseUrl: string;
  let serviceRoleKey: string;
  try {
    supabaseUrl = mustGetEnv("SUPABASE_URL").replace(/\/$/, "");
    serviceRoleKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, { status: 500 }, origin);
  }

  const auth = (req.headers.get("Authorization") ?? "").trim();
  const apikey = (req.headers.get("apikey") ?? "").trim();

  const res = await fetch(`${supabaseUrl}/functions/v1/contact-submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth.length > 0 ? auth : `Bearer ${serviceRoleKey}`,
      apikey: apikey.length > 0 ? apikey : serviceRoleKey,
    },
    body: JSON.stringify(hubBody),
  });

  const text = await res.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* passthrough */
  }

  if (parsed && res.ok) {
    const submissionId = parsed.submission_id ?? parsed.id;
    const leadId = parsed.lead_id;
    if (submissionId) {
      return jsonResponse(
        { id: submissionId, lead_id: leadId, submission_id: submissionId },
        { status: res.status },
        origin,
      );
    }
  }

  return new Response(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json; charset=utf-8",
      ...(corsHeaders(origin) as Record<string, string>),
    },
  });
});
