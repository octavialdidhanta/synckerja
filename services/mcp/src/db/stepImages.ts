import type { SupabaseClient } from "@supabase/supabase-js";
import { assertPublicHttpsUrl, isBlockedIp } from "../tools/leadmagnet/safePdfUrl";
import { lookup } from "node:dns/promises";

type Session = { userId: string; organizationId: string };

export type TaskStepImageRecord = {
  id: string;
  step_id: string;
  filename: string;
  file_url: string;
};

const BUCKET = "task-files";
const IMAGE_LIMIT_BYTES = 5 * 1024 * 1024;

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
} as const;

type ImageMime = keyof typeof IMAGE_TYPES;

function asRows<T>(data: unknown): T[] {
  if (data == null) return [];
  return Array.isArray(data) ? (data as T[]) : [data as T];
}

function sessionArgs(ctx: Session): Record<string, unknown> {
  return { p_user_id: ctx.userId, p_organization_id: ctx.organizationId };
}

function parseHostnameIsIp(host: string): boolean {
  return host.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

async function defaultResolve(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

async function resolvePublicHost(host: string, resolveHost: (hostname: string) => Promise<string[]>): Promise<void> {
  if (isBlockedIp(host)) throw new Error("invalid_input");
  if (parseHostnameIsIp(host)) return;
  const addresses = await resolveHost(host);
  if (addresses.length === 0 || addresses.some((address) => isBlockedIp(address))) throw new Error("invalid_input");
}

export function sniffImage(bytes: Uint8Array): { mime: ImageMime; ext: string } | null {
  if (bytes.byteLength < 12 || bytes.byteLength > IMAGE_LIMIT_BYTES) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return { mime: "image/gif", ext: "gif" };
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff === "RIFF" && webp === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

function acceptedType(header: string | null, sniffed: { mime: ImageMime; ext: string }): { mime: ImageMime; ext: string } {
  const mime = header?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!mime) return sniffed;
  const normalized = mime === "image/jpg" ? "image/jpeg" : mime;
  if (normalized !== sniffed.mime || !(normalized in IMAGE_TYPES)) throw new Error("invalid_input");
  return sniffed;
}

async function downloadImage(url: URL, fetchImpl: typeof fetch): Promise<{ bytes: Uint8Array; mime: ImageMime; ext: string }> {
  const response = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  if (response.status >= 300 && response.status < 400) throw new Error("invalid_input");
  if (!response.ok || !response.body) throw new Error("invalid_input");
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > IMAGE_LIMIT_BYTES) throw new Error("invalid_input");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    if (total > IMAGE_LIMIT_BYTES) throw new Error("invalid_input");
    chunks.push(step.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const sniffed = sniffImage(bytes);
  if (!sniffed) throw new Error("invalid_input");
  const image = acceptedType(response.headers.get("content-type"), sniffed);
  return { bytes, mime: image.mime, ext: image.ext };
}

function imageFileName(url: URL, ext: string): string {
  const raw = decodeURIComponent(url.pathname.split("/").pop() ?? "");
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  const base = cleaned.replace(/\.(jpe?g|png|gif|webp)$/i, "") || "image";
  return `${base.slice(0, 60)}.${ext}`;
}

function publicFileUrl(supabaseUrl: string, storagePath: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  const encoded = storagePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${base}/storage/v1/object/public/${BUCKET}/${encoded}`;
}

export async function attachTaskStepImage(
  admin: SupabaseClient,
  supabaseUrl: string,
  ctx: Session,
  input: { stepId: string; imageUrl: string },
  deps: {
    fetchImpl?: typeof fetch;
    resolveHost?: (hostname: string) => Promise<string[]>;
  } = {},
): Promise<TaskStepImageRecord> {
  const url = assertPublicHttpsUrl(input.imageUrl);
  await resolvePublicHost(url.hostname.replace(/\.$/, "").toLowerCase(), deps.resolveHost ?? defaultResolve);
  const image = await downloadImage(url, deps.fetchImpl ?? fetch);
  const filename = imageFileName(url, image.ext);
  const storagePath = `task-step-files/${input.stepId}/${crypto.randomUUID()}.${image.ext}`;
  const uploaded = await admin.storage.from(BUCKET).upload(storagePath, image.bytes, {
    contentType: image.mime,
    upsert: false,
  });
  if (uploaded.error) throw new Error(uploaded.error.message);

  try {
    const { data, error } = await admin.rpc("mcp_attach_task_step_image", {
      ...sessionArgs(ctx),
      p_step_id: input.stepId,
      p_filename: filename,
      p_file_url: publicFileUrl(supabaseUrl, storagePath),
      p_file_size: image.bytes.byteLength,
    });
    if (error) throw new Error(error.message);
    const row = asRows<TaskStepImageRecord>(data)[0];
    if (!row) throw new Error("not_found");
    return {
      id: row.id,
      step_id: row.step_id,
      filename: row.filename,
      file_url: row.file_url,
    };
  } catch (error) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }
}
