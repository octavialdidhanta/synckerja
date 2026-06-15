import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { brickJson, getBrickPublicAccessToken, type BrickEnv } from "./brickApi.ts";

export const BRICK_OAUTH_RETURN_PATHS = new Set([
  "/incomes/transaction",
  "/expenses/debt",
  "/finance/brick-oauth/callback",
]);

export function appPublicOrigin(): string {
  const explicit = Deno.env.get("APP_PUBLIC_ORIGIN")?.trim() ??
    Deno.env.get("VITE_APP_URL")?.trim() ??
    "";
  return explicit.replace(/\/+$/, "");
}

export function brickOAuthCallbackUrl(): string {
  const explicit = Deno.env.get("BRICK_AGGREGATION_CALLBACK_URL")?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  return `${supabaseUrl}/functions/v1/brick-oauth-callback`;
}

export function brickWidgetBaseUrl(): string {
  const sandbox = Deno.env.get("BRICK_SANDBOX") !== "false";
  return sandbox ? "https://sandbox.onebrick.io/v1" : "https://onebrick.io/v1";
}

/** Prefer app-hosted connect page when Brick legacy widget route is unavailable (sandbox). */
export function buildBrickWidgetUrl(
  publicAccessToken: string,
  redirectUrl: string,
  state: string,
  originOverride?: string,
): string {
  const template = Deno.env.get("BRICK_WIDGET_URL")?.trim();
  if (template) {
    return template
      .replaceAll("{accessToken}", encodeURIComponent(publicAccessToken))
      .replaceAll("{redirect_url}", encodeURIComponent(redirectUrl))
      .replaceAll("{state}", encodeURIComponent(state));
  }

  const sandbox = Deno.env.get("BRICK_SANDBOX") !== "false";
  const useAppConnect = Deno.env.get("BRICK_WIDGET_USE_APP_CONNECT") !== "false";
  const origin = (originOverride?.trim() || appPublicOrigin()).replace(/\/+$/, "");

  if ((useAppConnect || sandbox) && origin) {
    return `${origin}/finance/brick-oauth/connect?state=${encodeURIComponent(state)}`;
  }

  const base = brickWidgetBaseUrl();
  const params = new URLSearchParams({
    accessToken: publicAccessToken,
    redirect_url: redirectUrl,
    state,
  });
  return `${base}/index?${params.toString()}`;
}

export type BrickWidgetConnectMode = "app_connect" | "brick_widget";

export function resolveBrickWidgetConnectMode(originOverride?: string): BrickWidgetConnectMode {
  if (Deno.env.get("BRICK_WIDGET_URL")?.trim()) return "brick_widget";
  const sandbox = Deno.env.get("BRICK_SANDBOX") !== "false";
  const useAppConnect = Deno.env.get("BRICK_WIDGET_USE_APP_CONNECT") !== "false";
  const origin = (originOverride?.trim() || appPublicOrigin()).replace(/\/+$/, "");
  if ((useAppConnect || sandbox) && origin) return "app_connect";
  return "brick_widget";
}

/** App-hosted sandbox connect does not call Brick widget — no public token needed. */
export function shouldFetchBrickPublicTokenForOAuth(originOverride?: string): boolean {
  if (Deno.env.get("BRICK_WIDGET_URL")?.trim()) return true;
  return resolveBrickWidgetConnectMode(originOverride) === "brick_widget";
}

function brickCredentialErrorHint(message: string): string {
  if (!/credential|unauthorized|401/i.test(message)) return message;
  const sandbox = Deno.env.get("BRICK_SANDBOX") !== "false";
  return `${message} — Check Supabase secrets BRICK_CLIENT_ID / BRICK_CLIENT_SECRET match ${
    sandbox ? "Sandbox" : "Production"
  } API Credentials in Brick Dashboard (Configuration → API Credentials). BRICK_SANDBOX=${
    sandbox ? "true (default)" : "false"
  }.`;
}

export async function resolveBrickOAuthWidgetUrl(params: {
  env: BrickEnv;
  state: string;
  originOverride?: string;
}): Promise<{ widgetUrl: string; connectMode: BrickWidgetConnectMode }> {
  const connectMode = resolveBrickWidgetConnectMode(params.originOverride);
  const redirectUrl = `${brickOAuthCallbackUrl()}?synckerja=1`;

  let publicAccessToken = "app-connect-placeholder";
  if (shouldFetchBrickPublicTokenForOAuth(params.originOverride)) {
    try {
      publicAccessToken = await getBrickPublicAccessToken(params.env);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Failed to obtain Brick public access token";
      throw new Error(brickCredentialErrorHint(raw));
    }
  }

  const widgetUrl = buildBrickWidgetUrl(
    publicAccessToken,
    redirectUrl,
    params.state,
    params.originOverride,
  );
  return { widgetUrl, connectMode };
}

export function resolveBrickOAuthReturnPath(stored: string | null | undefined): string {
  const path = String(stored ?? "").trim();
  if (path && BRICK_OAUTH_RETURN_PATHS.has(path)) return path;
  return "/incomes/transaction";
}

export function redirectToAppPath(path: string, query: string, status = 302): Response {
  const origin = appPublicOrigin() || "http://localhost:5173";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new Response(null, {
    status,
    headers: { Location: `${origin}${normalizedPath}${query}` },
  });
}

export async function requireBrickImportSettings(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await admin
    .from("organization_brick_import_settings")
    .select("default_expense_category_id, default_expense_type_id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data?.default_expense_category_id || !data?.default_expense_type_id) {
    return { ok: false, error: "Configure default expense category and type for Brick import first." };
  }
  return { ok: true };
}

export function brickOAuthJson(body: object, status: number): Response {
  return brickJson(body, status);
}
