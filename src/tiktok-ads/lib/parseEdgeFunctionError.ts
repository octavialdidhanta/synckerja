export type TikTokAdsEdgeError = Error & { code?: string };

type ErrorPayload = { error?: string; code?: string; retryAfterSeconds?: number };

function formatEdgeErrorMessage(payload: ErrorPayload): string {
  if (!payload.error) return 'Edge function request failed';
  if (payload.retryAfterSeconds != null && payload.retryAfterSeconds > 0) {
    return `${payload.error} (tunggu ${payload.retryAfterSeconds} detik)`;
  }
  return payload.error;
}

export async function parseEdgeFunctionError(
  error: unknown,
  data: unknown,
): Promise<TikTokAdsEdgeError> {
  if (data && typeof data === "object" && data !== null) {
    const payload = data as ErrorPayload;
    if (payload.error) {
      const err = new Error(formatEdgeErrorMessage(payload)) as TikTokAdsEdgeError;
      if (payload.code) err.code = payload.code;
      return err;
    }
  }

  const errObj = error as { context?: Response; message?: string };
  if (errObj?.context) {
    try {
      const cloned = errObj.context.clone?.() ?? errObj.context;
      const body = (await cloned.json()) as ErrorPayload;
      if (body?.error) {
        const err = new Error(formatEdgeErrorMessage(body)) as TikTokAdsEdgeError;
        if (body.code) err.code = body.code;
        return err;
      }
      if (errObj.context.status === 401) {
        const err = new Error(
          "TikTok Ads authorization expired. Reconnect in TikTok Ads settings.",
        ) as TikTokAdsEdgeError;
        err.code = "TOKEN_EXPIRED";
        return err;
      }
      if (errObj.context.status === 502 || errObj.context.status === 500) {
        const err = new Error(
          body?.error ?? "Edge function failed. Check Supabase function logs.",
        ) as TikTokAdsEdgeError;
        if (body?.code) err.code = body.code;
        return err;
      }
    } catch {
      /* ignore */
    }
  }

  if (error instanceof Error) return error as TikTokAdsEdgeError;
  return new Error(errObj?.message ?? "Edge function request failed") as TikTokAdsEdgeError;
}
