export type GoogleAdsEdgeError = Error & {
  code?: string;
  unsupported_metrics?: string[];
};

type ErrorPayload = {
  error?: string;
  code?: string;
  unsupported_metrics?: string[];
};

function attachPayload(err: Error, payload: ErrorPayload): GoogleAdsEdgeError {
  const out = err as GoogleAdsEdgeError;
  if (payload.code) out.code = payload.code;
  if (Array.isArray(payload.unsupported_metrics) && payload.unsupported_metrics.length > 0) {
    out.unsupported_metrics = payload.unsupported_metrics;
    if (payload.code !== "UNSUPPORTED_METRICS") {
      out.code = "UNSUPPORTED_METRICS";
    }
  }
  return out;
}

/** Extract JSON error body from supabase.functions.invoke when status is non-2xx. */
export async function parseEdgeFunctionError(
  error: unknown,
  data: unknown,
): Promise<GoogleAdsEdgeError> {
  if (data && typeof data === "object" && data !== null) {
    const payload = data as ErrorPayload;
    if (payload.error) {
      return attachPayload(new Error(payload.error), payload);
    }
  }

  const errObj = error as { context?: Response; message?: string };
  if (errObj?.context) {
    try {
      const cloned = errObj.context.clone?.() ?? errObj.context;
      const rawText = await cloned.text();
      if (rawText) {
        try {
          const body = JSON.parse(rawText) as ErrorPayload;
          if (body?.error) {
            return attachPayload(new Error(body.error), body);
          }
        } catch {
          if (rawText.trim().length > 0 && rawText.length < 500) {
            return new Error(rawText.trim()) as GoogleAdsEdgeError;
          }
        }
      }
      if (errObj.context.status === 401) {
        const err = new Error(
          "Google Ads authorization expired. Reconnect in Omnichannel → Google Ads settings.",
        ) as GoogleAdsEdgeError;
        err.code = "TOKEN_REFRESH_FAILED";
        return err;
      }
      if (errObj.context.status === 403) {
        const err = new Error("Access denied.") as GoogleAdsEdgeError;
        err.code = "FORBIDDEN";
        return err;
      }
      if (errObj.context.status === 503) {
        const err = new Error(
          "Google Ads edge function gagal (HTTP 503 / BOOT_ERROR). Silakan coba reload atau cek konfigurasi & deploy server.",
        ) as GoogleAdsEdgeError;
        err.code = "GOOGLE_ADS_EDGE_BOOT_FAILED";
        return err;
      }
      if (errObj.context.status === 504 || errObj.context.status === 546) {
        const err = new Error(
          "Google Ads metrics timed out. Try a shorter date range or fewer columns.",
        ) as GoogleAdsEdgeError;
        err.code = "EDGE_TIMEOUT";
        return err;
      }
    } catch {
      // ignore parse failure
    }
  }

  if (error instanceof Error) return error as GoogleAdsEdgeError;
  return new Error(errObj?.message ?? "Edge function request failed") as GoogleAdsEdgeError;
}

export function isUnsupportedMetricsError(
  err: unknown,
): err is GoogleAdsEdgeError & { unsupported_metrics: string[] } {
  return (
    err != null &&
    typeof err === "object" &&
    Array.isArray((err as GoogleAdsEdgeError).unsupported_metrics) &&
    (err as GoogleAdsEdgeError).unsupported_metrics!.length > 0
  );
}
