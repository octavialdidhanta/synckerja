export type LeadPreviewSubmission = {
  name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  notes?: string | null;
  form_data?: Record<string, unknown> | null;
  submitted_at?: string | null;
};

export const LEAD_PREVIEW_SAMPLE_SUBMISSION: LeadPreviewSubmission = {
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

function paramOrDash(value: unknown): string {
  const s = value == null ? "" : String(value).trim();
  return s.length > 0 ? s.slice(0, 1024) : "-";
}

type LeadValueArgs = {
  name: string;
  email: string | null;
  phoneNumber: string;
  notes?: string | null;
  formData: Record<string, unknown> | null;
};

function toLeadValueArgs(submission: LeadPreviewSubmission | null | undefined): LeadValueArgs {
  const fd = submission?.form_data ?? null;
  return {
    name: String(submission?.name ?? ""),
    email: submission?.email != null ? String(submission.email) : null,
    phoneNumber: String(submission?.phone_number ?? ""),
    notes: submission?.notes != null ? String(submission.notes) : null,
    formData: fd && typeof fd === "object" && !Array.isArray(fd) ? fd : null,
  };
}

/** Mirrors server `resolveBodyKeyValue` for preview parity. */
export function resolveBodyKeyValue(key: string, args: LeadValueArgs): string {
  const fd = args.formData ?? {};
  const normalized = key.trim().toLowerCase();

  switch (normalized) {
    case "name":
    case "client":
    case "customer_name":
      return paramOrDash(args.name);
    case "email":
      return paramOrDash(args.email);
    case "phone":
    case "phone_number":
    case "customer_phone":
      return paramOrDash(args.phoneNumber);
    case "notes":
      return paramOrDash(args.notes);
    case "package_label":
    case "package":
    case "needs":
    case "ringkasan_kebutuhan":
      return paramOrDash(fd.package_label ?? fd[normalized] ?? fd[key]);
    case "event_date":
      return paramOrDash(fd.event_date);
    case "event_time":
      return paramOrDash(fd.event_time);
    case "event_address":
    case "office_address":
    case "address":
      return paramOrDash(fd.event_address ?? fd.office_address ?? fd.address);
    case "industry":
    case "business_type":
      return paramOrDash(fd[normalized] ?? fd[key]);
    default:
      return paramOrDash(fd[normalized] ?? fd[key]);
  }
}

export function buildBodyParamsFromSlotMapping(
  slotMapping: Record<number, string>,
  slotCount: number,
  submission: LeadPreviewSubmission | null | undefined,
  options?: { sampleFallback?: boolean },
): string[] {
  const realArgs = toLeadValueArgs(submission);
  const sampleArgs = toLeadValueArgs(LEAD_PREVIEW_SAMPLE_SUBMISSION);
  const useSampleFallback = options?.sampleFallback !== false;

  const params: string[] = [];
  for (let slot = 1; slot <= slotCount; slot++) {
    const key = slotMapping[slot]?.trim() ?? "";
    if (!key) {
      params.push("-");
      continue;
    }
    const real = resolveBodyKeyValue(key, realArgs);
    if (real !== "-" || !useSampleFallback) {
      params.push(real);
      continue;
    }
    params.push(resolveBodyKeyValue(key, sampleArgs));
  }
  return params;
}

/** Fill BODY placeholders only — matches WhatsApp send (body component parameters). */
export function fillBodyTemplatePlaceholders(bodyText: string, bodyParams: string[]): string {
  let idx = 0;
  return bodyText.replace(/\{\{[^}]+\}\}/g, () => {
    const val = bodyParams[idx++];
    return val !== undefined && String(val).trim() !== "" ? String(val) : "-";
  });
}

export function buildLeadTemplateBodyPreviewText(
  bodyFull: string,
  slotMapping: Record<number, string>,
  slotCount: number,
  submission: LeadPreviewSubmission | null | undefined,
): string {
  const params = buildBodyParamsFromSlotMapping(slotMapping, slotCount, submission, {
    sampleFallback: true,
  });
  return fillBodyTemplatePlaceholders(bodyFull, params);
}

export function previewUsesSampleData(
  slotMapping: Record<number, string>,
  slotCount: number,
  submission: LeadPreviewSubmission | null | undefined,
): boolean {
  if (!submission) return true;
  const realArgs = toLeadValueArgs(submission);
  for (let slot = 1; slot <= slotCount; slot++) {
    const key = slotMapping[slot]?.trim();
    if (!key) continue;
    if (resolveBodyKeyValue(key, realArgs) === "-") return true;
  }
  return false;
}
