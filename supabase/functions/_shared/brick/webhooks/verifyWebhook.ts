import type { BrickEnvConfig } from "../brickEnv.ts";

function escapeJsonForBrickSignature(json: string): string {
  return json.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

export async function verifyBrickWebhookSignature(
  req: Request,
  rawBody: string,
  env: BrickEnvConfig,
): Promise<boolean> {
  if (env.skipWebhookVerify) return true;
  const secret = env.callbackSecret;
  if (!secret) return false;

  const signature = req.headers.get("X-SIGNATURE") ?? req.headers.get("x-signature") ?? "";
  const timestamp = req.headers.get("X-TIMESTAMP") ?? req.headers.get("x-timestamp") ?? "";
  if (!signature || !timestamp) return false;

  const message = `${escapeJsonForBrickSignature(rawBody)}|${timestamp}`;
  const digest = await sha256Hex(message);
  return digest.toLowerCase() === signature.toLowerCase();
}

async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isBrickWebhookRequest(req: Request, body: Record<string, unknown>): boolean {
  if (body.action) return false;
  const sig = req.headers.get("X-SIGNATURE") ?? req.headers.get("x-signature");
  const ts = req.headers.get("X-TIMESTAMP") ?? req.headers.get("x-timestamp");
  if (sig && ts) return true;
  const data = body.data as Record<string, unknown> | undefined;
  if (!data) return false;
  if (data.type === "payment") return true;
  if (data.type === "disbursement") return true;
  if (data.attributes || data.paymentId || data.status) return true;
  return false;
}
