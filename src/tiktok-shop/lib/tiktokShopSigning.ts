/**
 * TikTok Shop Partner API request signing (vitest mirror of edge tiktokShopSign.ts).
 */

export type TikTokShopSignInput = {
  path: string;
  queryParams: Record<string, string>;
  body?: string;
  appSecret: string;
};

function sortObjectKeys(params: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(params).sort()) {
    sorted[key] = params[key];
  }
  return sorted;
}

export function buildTikTokShopSignString(
  path: string,
  queryParams: Record<string, string>,
  body: string,
  appSecret: string,
): string {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(queryParams)) {
    if (key === "sign" || key === "access_token") continue;
    filtered[key] = value;
  }
  const sorted = sortObjectKeys(filtered);
  let paramString = "";
  for (const [key, value] of Object.entries(sorted)) {
    paramString += `${key}${value}`;
  }
  return `${appSecret}${path}${paramString}${body}${appSecret}`;
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeTikTokShopSign(input: TikTokShopSignInput): Promise<string> {
  const signString = buildTikTokShopSignString(
    input.path,
    input.queryParams,
    input.body ?? "",
    input.appSecret,
  );
  return await hmacSha256Hex(signString, input.appSecret);
}
