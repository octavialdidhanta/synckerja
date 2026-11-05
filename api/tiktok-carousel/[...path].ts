import { authorizeCarouselImageRequest, CAROUSEL_STORAGE_BUCKET } from "../../supabase/functions/_shared/tiktokCarouselImageUrl.ts";

type ApiResponse = {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => ApiResponse;
  send: (body: Buffer | string) => void;
  end: () => void;
};

type ApiRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
};

function firstQuery(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function storagePathFromQuery(path: string | string[] | undefined): string {
  const parts = Array.isArray(path) ? path : path ? [path] : [];
  return parts.map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  }).join("/");
}

function text(res: ApiResponse, status: number, error: string): void {
  res.status(status).setHeader("Content-Type", "text/plain; charset=utf-8").send(error);
}

/**
 * Public JPEG for TikTok PULL_FROM_URL.
 * Env: TIKTOK_CAROUSEL_URL_SECRET, SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.
 * Response is the image bytes. Never redirect.
 */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const method = String(req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    res.status(405).setHeader("Allow", "GET, HEAD").end();
    return;
  }

  const decision = await authorizeCarouselImageRequest({
    storagePath: storagePathFromQuery(req.query.path),
    expRaw: firstQuery(req.query.exp),
    sig: firstQuery(req.query.sig),
    secret: process.env.TIKTOK_CAROUSEL_URL_SECRET ?? "",
  });
  if (!decision.ok) {
    text(res, decision.status, decision.error);
    return;
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceRole) {
    text(res, 500, "storage_not_configured");
    return;
  }

  const objectPath = decision.storagePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  const upstream = await fetch(
    `${supabaseUrl}/storage/v1/object/${CAROUSEL_STORAGE_BUCKET}/${objectPath}`,
    {
      headers: {
        Authorization: `Bearer ${serviceRole}`,
        apikey: serviceRole,
      },
      redirect: "manual",
    },
  );
  if (upstream.status >= 300 && upstream.status < 400) {
    text(res, 502, "storage_redirect");
    return;
  }
  if (!upstream.ok) {
    text(res, 404, "carousel_image_not_found");
    return;
  }

  const bytes = Buffer.from(await upstream.arrayBuffer());
  res.status(200);
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Length", String(bytes.byteLength));
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (method === "HEAD") {
    res.end();
    return;
  }
  res.send(bytes);
}
