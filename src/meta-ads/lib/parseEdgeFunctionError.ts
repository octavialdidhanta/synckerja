export type MetaAdsEdgeError = Error & { code?: string };

type ErrorPayload = { error?: string; code?: string };

export async function parseEdgeFunctionError(
  error: unknown,
  data: unknown,
): Promise<MetaAdsEdgeError> {
  if (data && typeof data === "object" && data !== null) {
    const payload = data as ErrorPayload;
    if (payload.error) {
      const err = new Error(payload.error) as MetaAdsEdgeError;
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
        const err = new Error(body.error) as MetaAdsEdgeError;
        if (body.code) err.code = body.code;
        return err;
      }
      if (errObj.context.status === 401) {
        const err = new Error(
          "Meta Ads authorization expired. Reconnect in Offline Conversion settings.",
        ) as MetaAdsEdgeError;
        err.code = "TOKEN_EXPIRED";
        return err;
      }
    } catch {
      /* ignore */
    }
  }

  if (error instanceof Error) return error as MetaAdsEdgeError;
  return new Error(errObj?.message ?? "Edge function request failed") as MetaAdsEdgeError;
}
