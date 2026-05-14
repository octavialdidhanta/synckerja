/**
 * Midtrans environment helpers for Edge Functions.
 *
 * Deploy note: Supabase bundles each function folder in isolation — keep this file
 * duplicated alongside other Midtrans edge functions (same contents).
 *
 * - Legacy sandbox keys often use prefix `SB-Mid-server-` / `SB-Mid-client-`.
 * - Newer Midtrans dashboards may show sandbox keys as `Mid-server-` / `Mid-client-`
 *   (same prefix shape as production), so prefix alone is not enough.
 *
 * How sandbox vs production is chosen (`midtransIsSandbox`):
 * 1. `MIDTRANS_ENV` = sandbox|dev|development vs production|prod
 * 2. `MIDTRANS_USE_SANDBOX` = true/false/1/0/yes/no (use when sandbox keys look like Mid-server-…)
 * 3. Heuristic: `SB-Mid-` server key → sandbox
 * 4. Default → production
 *
 * Optional URL overrides (bypass default hosts): `MIDTRANS_SNAP_API_BASE_URL`,
 * `MIDTRANS_CORE_API_BASE_URL`, `MIDTRANS_SNAP_JS_URL`.
 */

function envBool(name: string): boolean | undefined {
  const v = (Deno.env.get(name) ?? "").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return undefined;
}

/** True when Snap + Core API calls should hit Midtrans sandbox hosts. */
export function midtransIsSandbox(): boolean {
  const envName = (Deno.env.get("MIDTRANS_ENV") ?? "").trim().toLowerCase();
  if (envName === "sandbox" || envName === "dev" || envName === "development") return true;
  if (envName === "production" || envName === "prod") return false;

  const explicit = envBool("MIDTRANS_USE_SANDBOX");
  if (explicit !== undefined) return explicit;

  const serverKey = (Deno.env.get("MIDTRANS_SERVER_KEY") ?? "").trim();
  if (serverKey.startsWith("SB-Mid-")) return true;

  return false;
}

/** e.g. https://app.sandbox.midtrans.com or https://app.midtrans.com (no path). */
export function midtransSnapApiBaseUrl(): string {
  const override = (Deno.env.get("MIDTRANS_SNAP_API_BASE_URL") ?? "").trim().replace(/\/+$/, "");
  if (override) return override;
  return midtransIsSandbox() ? "https://app.sandbox.midtrans.com" : "https://app.midtrans.com";
}

/** e.g. https://api.sandbox.midtrans.com or https://api.midtrans.com (no path). */
export function midtransCoreApiBaseUrl(): string {
  const override = (Deno.env.get("MIDTRANS_CORE_API_BASE_URL") ?? "").trim().replace(/\/+$/, "");
  if (override) return override;
  return midtransIsSandbox() ? "https://api.sandbox.midtrans.com" : "https://api.midtrans.com";
}

/** Full URL for Snap embed script (browser). */
export function midtransSnapJsUrl(): string {
  const override = (Deno.env.get("MIDTRANS_SNAP_JS_URL") ?? "").trim();
  if (override) return override;
  return `${midtransSnapApiBaseUrl()}/snap/snap.js`;
}
