/** Respons JSON standar API publik Omnichannel (Bahasa Indonesia di pesan error). */

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "LEAD_NOT_MATCHED"
  | "INTERNAL_ERROR";

export function apiJson(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function apiSuccess(
  data: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return apiJson({ success: true, ...data }, status, corsHeaders);
}

export function apiError(
  error: string,
  code: ApiErrorCode,
  status: number,
  corsHeaders: Record<string, string>,
  details?: unknown,
): Response {
  return apiJson(
    {
      success: false,
      error,
      code,
      ...(details !== undefined ? { details } : {}),
    },
    status,
    corsHeaders,
  );
}

export function buildCorsHeaders(origin: string | null, allowedOrigins: string[]): Record<string, string> {
  const base = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };

  if (!origin) {
    return { ...base, "Access-Control-Allow-Origin": "*" };
  }

  const normalized = origin.trim().toLowerCase();
  const allowed = allowedOrigins.map((o) => o.trim().toLowerCase()).filter(Boolean);

  if (allowed.length === 0) {
    return { ...base, "Access-Control-Allow-Origin": "*" };
  }

  if (allowed.includes(normalized) || allowed.includes("*")) {
    return { ...base, "Access-Control-Allow-Origin": origin };
  }

  return { ...base, "Access-Control-Allow-Origin": "null" };
}
