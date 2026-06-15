import type { BrickEnv } from "./brickApi.ts";

export type BrickEnvConfig = BrickEnv & {
  callbackSecret: string | null;
  skipWebhookVerify: boolean;
};

export function readBrickEnvConfig(): BrickEnvConfig | null {
  const clientId = Deno.env.get("BRICK_CLIENT_ID")?.trim() ?? "";
  const clientSecret = Deno.env.get("BRICK_CLIENT_SECRET")?.trim() ?? "";
  const useMock = Deno.env.get("BRICK_USE_MOCK") === "true";
  if (!clientId || !clientSecret) {
    if (!useMock) return null;
  }
  const baseUrl = (() => {
    const explicit = Deno.env.get("BRICK_API_BASE_URL")?.trim();
    if (explicit) return explicit.replace(/\/+$/, "");
    const sandbox = Deno.env.get("BRICK_SANDBOX") !== "false";
    return sandbox ? "https://sandbox.onebrick.io/v2" : "https://api.onebrick.io/v2";
  })();

  return {
    baseUrl,
    clientId: clientId || "mock",
    clientSecret: clientSecret || "mock",
    useMock,
    callbackSecret: Deno.env.get("BRICK_CALLBACK_SECRET")?.trim() || null,
    skipWebhookVerify: Deno.env.get("BRICK_WEBHOOK_SKIP_VERIFY") === "true",
  };
}
