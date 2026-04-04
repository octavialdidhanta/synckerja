/**
 * Supabase client and some API responses surface low-level messages that confuse end users.
 */
export function shouldReplaceDriveApiError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("edge function") ||
    m.includes("non-2xx") ||
    m.includes("functionsfetch") ||
    m.includes("failed to send a request") ||
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed") ||
    m.includes("internal server error") ||
    m.includes("server configuration error") ||
    m.includes("status code")
  );
}
