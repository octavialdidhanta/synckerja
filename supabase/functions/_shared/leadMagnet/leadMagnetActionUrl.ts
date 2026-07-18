export type LeadMagnetAction = "follow_confirm" | "get_framework" | "download";

const ACTION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function actionSecret(): string {
  const dedicated = (Deno.env.get("LEAD_MAGNET_ACTION_SECRET") ?? "").trim();
  if (dedicated) return dedicated;
  return (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
}

export function publicAppOrigin(): string {
  const candidates = [
    Deno.env.get("PUBLIC_APP_ORIGIN"),
    Deno.env.get("VITE_APP_URL"),
  ]
    .map((s) => (s ?? "").trim().replace(/\/$/, ""))
    .filter(Boolean);

  for (const origin of candidates) {
    // Never use Supabase host for Messenger web_url — in-app browser shows raw HTML.
    if (!origin.includes("supabase.co")) return origin;
  }
  return "https://office.synckerja.com";
}

export function buildLeadMagnetSpaActionUrl(searchParams: string): string {
  const qs = searchParams.trim();
  return `${publicAppOrigin()}${leadMagnetActionPagePath()}${qs ? `?${qs}` : ""}`;
}

export function wantsJsonActionApi(req: Request): boolean {
  const accept = (req.headers.get("Accept") ?? "").toLowerCase();
  return accept.includes("application/json");
}

/** Messenger in-app browser often ignores 302; meta refresh + JS is more reliable. */
export function buildSpaRedirectHtml(searchParams: string): string {
  return buildSpaPageRedirectHtml(searchParams, "action");
}

export function buildSpaDownloadRedirectHtml(searchParams: string): string {
  return buildSpaPageRedirectHtml(searchParams, "download");
}

function buildSpaPageRedirectHtml(searchParams: string, kind: "action" | "download"): string {
  const target = kind === "download"
    ? buildLeadMagnetSpaDownloadUrl(searchParams)
    : buildLeadMagnetSpaActionUrl(searchParams);
  const safeTarget = target.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const jsTarget = JSON.stringify(target);
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0;url=${safeTarget}" />
  <title>Mengalihkan…</title>
  <script>location.replace(${jsTarget});</script>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f3f4f6; color: #111827; text-align: center; padding: 1rem; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <p>Mengalihkan… <a href="${safeTarget}">Klik di sini</a> jika tidak otomatis.</p>
</body>
</html>`;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SPA landing page — Messenger webview renders office.synckerja.com reliably. */
export function leadMagnetActionPagePath(): string {
  return "/digital-marketing/lead-magnet/action";
}

/** SPA download landing — short trusted URL for Messenger buttons. */
export function leadMagnetDownloadPagePath(): string {
  return "/digital-marketing/lead-magnet/download";
}

export function buildLeadMagnetSpaDownloadUrl(searchParams: string): string {
  const qs = searchParams.trim();
  return `${publicAppOrigin()}${leadMagnetDownloadPagePath()}${qs ? `?${qs}` : ""}`;
}

export function leadMagnetDownloadApiPath(): string {
  return "/functions/v1/lead-magnet-runtime/download";
}

function supabaseFunctionsOrigin(): string {
  const url = (Deno.env.get("SUPABASE_URL") ?? "").trim().replace(/\/$/, "");
  return url || "https://wqdzqqshoifwyrltzgvx.supabase.co";
}

export type DownloadLandingBody = {
  ok: boolean;
  code: string;
  title: string;
  message: string;
  fileUrl?: string | null;
  buttonLabel?: string | null;
  fileName?: string | null;
};

export function buildDownloadLandingHtml(body: DownloadLandingBody): string {
  const safeTitle = body.title.replace(/</g, "&lt;");
  const safeMessage = body.message.replace(/</g, "&lt;");
  const buttonLabel = (body.buttonLabel ?? "Unduh").replace(/</g, "&lt;");
  const fileUrl = body.fileUrl ?? "";
  const safeFileUrl = fileUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const downloadBtn = body.ok && fileUrl
    ? `<a href="${safeFileUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;width:100%;max-width:18rem;align-items:center;justify-content:center;border-radius:0.5rem;background:#2563eb;color:#fff;font-size:0.9375rem;font-weight:600;padding:0.625rem 1rem;text-decoration:none;margin-top:1rem;">${buttonLabel}</a>`
    : "";
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <title>${safeTitle}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f3f4f6; color: #111827; }
    .card { max-width: 22rem; padding: 1.5rem; border-radius: 0.75rem; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.12); text-align: center; }
    h1 { font-size: 1.125rem; margin: 0 0 0.5rem; }
    p { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: #4b5563; }
    .foot { margin-top: 1rem; font-size: 0.75rem; color: #6b7280; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    ${downloadBtn}
    <p class="foot">File materi dari kampanye Lead Magnet Synckerja.</p>
  </div>
</body>
</html>`;
}

export async function buildLeadMagnetDownloadUrl(
  enrollmentId: string,
  linkIndex = 0,
): Promise<string> {
  const secret = actionSecret();
  if (!secret) throw new Error("Missing action signing secret");

  const i = Math.max(0, Math.min(2, Math.floor(Number(linkIndex) || 0)));
  const expiry = String(Date.now() + ACTION_TTL_MS);
  const canonical = `${enrollmentId}:download:${i}:${expiry}`;
  const sig = await hmacSha256Hex(secret, canonical);
  const params = new URLSearchParams({
    e: enrollmentId,
    a: "download",
    t: expiry,
    s: sig,
    i: String(i),
  });
  // Edge /download → 302 langsung ke file PDF (tidak bergantung deploy SPA office.synckerja.com).
  return `${supabaseFunctionsOrigin()}${leadMagnetDownloadApiPath()}?${params.toString()}`;
}

export function leadMagnetActionApiPath(): string {
  return "/functions/v1/lead-magnet-runtime/action";
}

export async function buildLeadMagnetActionUrl(
  enrollmentId: string,
  action: LeadMagnetAction,
): Promise<string> {
  const secret = actionSecret();
  if (!secret) throw new Error("Missing action signing secret");

  const expiry = String(Date.now() + ACTION_TTL_MS);
  const canonical = `${enrollmentId}:${action}:${expiry}`;
  const sig = await hmacSha256Hex(secret, canonical);
  const params = new URLSearchParams({
    e: enrollmentId,
    a: action,
    t: expiry,
    s: sig,
  });
  const pagePath = action === "download" ? leadMagnetDownloadPagePath() : leadMagnetActionPagePath();
  return `${publicAppOrigin()}${pagePath}?${params.toString()}`;
}

export async function verifyLeadMagnetActionUrl(
  enrollmentId: string,
  action: LeadMagnetAction,
  expiryRaw: string,
  sigRaw: string,
  linkIndex?: number,
): Promise<boolean> {
  const secret = actionSecret();
  if (!secret) return false;

  const expiryMs = Number(expiryRaw);
  if (!Number.isFinite(expiryMs) || expiryMs < Date.now()) return false;
  if (action !== "follow_confirm" && action !== "get_framework" && action !== "download") return false;
  if (!enrollmentId.trim()) return false;

  const expectedSig = sigRaw.trim();
  if (action === "download") {
    const i = Math.max(0, Math.min(2, Math.floor(Number(linkIndex) || 0)));
    const indexed = await hmacSha256Hex(secret, `${enrollmentId}:download:${i}:${expiryRaw}`);
    if (indexed === expectedSig) return true;
    // Legacy single-link signatures (no index in HMAC).
    if (i === 0) {
      const legacy = await hmacSha256Hex(secret, `${enrollmentId}:download:${expiryRaw}`);
      return legacy === expectedSig;
    }
    return false;
  }

  const canonical = `${enrollmentId}:${action}:${expiryRaw}`;
  const expected = await hmacSha256Hex(secret, canonical);
  return expected === expectedSig;
}
