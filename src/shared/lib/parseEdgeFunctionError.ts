export type EdgeFunctionError = Error & { code?: string };

type ErrorPayload = { error?: string; code?: string };

/** Extract JSON error body from supabase.functions.invoke when status is non-2xx. */
export async function parseEdgeFunctionError(
  error: unknown,
  data: unknown,
): Promise<EdgeFunctionError> {
  if (data && typeof data === "object" && data !== null) {
    const payload = data as ErrorPayload;
    if (payload.error) {
      const err = new Error(payload.error) as EdgeFunctionError;
      if (payload.code) err.code = payload.code;
      return err;
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
            const err = new Error(body.error) as EdgeFunctionError;
            if (body.code) err.code = body.code;
            return err;
          }
        } catch {
          if (rawText.trim().length > 0 && rawText.length < 500) {
            return new Error(rawText.trim()) as EdgeFunctionError;
          }
        }
      }
      if (errObj.context.status === 401) {
        const err = new Error("Session expired. Please sign in again.") as EdgeFunctionError;
        err.code = "UNAUTHORIZED";
        return err;
      }
    } catch {
      /* ignore */
    }
  }

  if (error instanceof Error) return error as EdgeFunctionError;
  return new Error(errObj?.message ?? "Edge function request failed") as EdgeFunctionError;
}
