import { lookup } from "node:dns/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertPdfBytes,
  assertPublicHttpsUrl,
  isBlockedIp,
  pdfByteLimit,
  pdfFileName,
} from "../tools/leadmagnet/safePdfUrl";

type Session = { userId: string; organizationId: string };

export type LeadMagnetDraft = {
  id: string;
  name: string;
  target_market: string;
  keyword: string;
  comment_reply_text: string;
  follow_gate_text: string;
  framework_offer_text: string;
  delivery_text: string;
  delivery_button_label: string;
  has_file: boolean;
  file_name: string | null;
  social_media_plan_id: string | null;
};

export type LeadMagnetDeliveryResult = {
  id: string;
  file_name: string;
  has_file: boolean;
};

const BUCKET = "lead-magnet-assets";

function asRows<T>(data: unknown): T[] {
  if (data == null) return [];
  return Array.isArray(data) ? (data as T[]) : [data as T];
}

async function callRpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  return asRows<T>(data);
}

function sessionArgs(ctx: Session): Record<string, unknown> {
  return { p_user_id: ctx.userId, p_organization_id: ctx.organizationId };
}

export function listLeadMagnetDrafts(
  admin: SupabaseClient,
  ctx: Session,
  campaignId: string | null,
): Promise<LeadMagnetDraft[]> {
  return callRpc<LeadMagnetDraft>(admin, "mcp_list_lead_magnet_drafts", {
    ...sessionArgs(ctx),
    p_campaign_id: campaignId,
  });
}

async function resolvePublicHost(host: string, resolveHost: (hostname: string) => Promise<string[]>): Promise<void> {
  if (isBlockedIp(host)) throw new Error("invalid_input");
  if (parseHostnameIsIp(host)) return;
  const addresses = await resolveHost(host);
  if (addresses.length === 0 || addresses.some((address) => isBlockedIp(address))) throw new Error("invalid_input");
}

function parseHostnameIsIp(host: string): boolean {
  return host.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

async function defaultResolve(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

async function downloadPdf(url: URL, fetchImpl: typeof fetch): Promise<Uint8Array> {
  const response = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  if (response.status >= 300 && response.status < 400) throw new Error("invalid_input");
  if (!response.ok || !response.body) throw new Error("invalid_input");
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > pdfByteLimit()) throw new Error("invalid_input");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    if (total > pdfByteLimit()) throw new Error("invalid_input");
    chunks.push(step.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  assertPdfBytes(bytes);
  return bytes;
}

function publicFileUrl(supabaseUrl: string, storagePath: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  const encoded = storagePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${base}/storage/v1/object/public/${BUCKET}/${encoded}`;
}

export async function attachLeadMagnetDelivery(
  admin: SupabaseClient,
  supabaseUrl: string,
  ctx: Session,
  input: { campaignId: string; fileUrl: string },
  deps: {
    fetchImpl?: typeof fetch;
    resolveHost?: (hostname: string) => Promise<string[]>;
  } = {},
): Promise<LeadMagnetDeliveryResult> {
  const url = assertPublicHttpsUrl(input.fileUrl);
  await resolvePublicHost(url.hostname.replace(/\.$/, "").toLowerCase(), deps.resolveHost ?? defaultResolve);
  const drafts = await listLeadMagnetDrafts(admin, ctx, input.campaignId);
  if (drafts.length !== 1) throw new Error("not_found");

  const bytes = await downloadPdf(url, deps.fetchImpl ?? fetch);
  const fileName = pdfFileName(url);
  const storagePath = `${ctx.organizationId.toLowerCase()}/${input.campaignId.toLowerCase()}/${crypto.randomUUID()}_${fileName}`;
  const uploaded = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploaded.error) throw new Error(uploaded.error.message);

  try {
    const rows = await callRpc<{
      id: string;
      file_name: string;
      has_file: boolean;
      previous_storage_path: string | null;
    }>(admin, "mcp_set_lead_magnet_delivery", {
      ...sessionArgs(ctx),
      p_campaign_id: input.campaignId,
      p_storage_path: storagePath,
      p_file_name: fileName,
      p_mime: "application/pdf",
      p_size_bytes: bytes.byteLength,
      p_public_url: publicFileUrl(supabaseUrl, storagePath),
    });
    const saved = rows[0];
    if (!saved) throw new Error("not_found");
    if (saved.previous_storage_path && saved.previous_storage_path !== storagePath) {
      await admin.storage.from(BUCKET).remove([saved.previous_storage_path]);
    }
    return { id: saved.id, file_name: saved.file_name, has_file: saved.has_file };
  } catch (error) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }
}
