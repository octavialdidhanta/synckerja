import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractAgentToken,
  isUuid,
  mapRpcError,
  parseAuthRow,
  parseFileKeys,
  parseHeartbeat,
  parseMediaDone,
  routePath,
  sha256Hex,
  AGENT_MIN_VERSION,
  versionOlderThan,
} from "./logic.ts";
import { AgentReleaseError, latestAgentRelease } from "../_shared/agentRelease.ts";

/**
 * API for the Synckerja Agent (laptop program). Spec: github.com/octavialdidhanta/synckerja-agent SPEC.md.
 *
 * Auth: Authorization: Bearer sk_agent_<prefix>_<secret> (created in Office → Settings → Agent).
 * The organization always comes from the token, never from the request.
 * Server-to-server only: requests carrying a browser Origin are refused.
 *
 *   GET  /v1/whoami      → organization, scopes, token expiry
 *   POST /v1/heartbeat   → { device_name, agent_version, platform, tools, last_error } + X-Agent-Device: <uuid>
 *   GET  /v1/release     → { version, zip_url } latest Agent release; zip_url is GitHub's pre-signed link (minutes)
 *   Work routes answer 426 update_required when X-Agent-Version is below AGENT_MIN_VERSION.
 *   The floor is 0.0.0 until a self-updating release is installed, so current laptops are not rejected.
 *
 * Footage (scope "catalog"), step 3: the Agent adds inbox clips, and moves a hidden clip out of the watched folder.
 *   POST /v1/footage/check         { file_keys }                    → which already exist
 *   POST /v1/footage/register      { clip }  (footage.clips.create)  → asset_id + scene ids
 *   POST /v1/footage/media-upload  { asset_id }                      → signed upload URLs (preview + thumbs)
 *   POST /v1/footage/media-done    { asset_id, preview, scene_ids }  → link the uploaded files
 *
 * AI tags (scope "catalog"), step 4: only clips still "belum" (never a person's tags).
 *   GET  /v1/catalog/context       tag defs, scene kinds, menus, locations, bans, tagged examples
 *   GET  /v1/footage/untagged      clips waiting for AI tags
 *   POST /v1/footage/tags          { asset_id, tags }                → saved as "perlu dicek"
 *
 * Inbox → bank (scope "catalog"), step 5: only after the video using the clip is final.
 *   GET  /v1/footage/movable       inbox clips whose content is final
 *   POST /v1/footage/moved         { asset_id, new_file_key }        → after the laptop moved the file
 *   GET  /v1/footage/file-tasks    hide / restore / purge for laptop files
 *   POST /v1/footage/file-task     { asset_id, result, hold_key? }   → after the file moved or was missing
 *
 * Render queue (scope "render"), step 6. claim_token proves the Agent still owns the job.
 *   POST /v1/jobs/claim                                              → oldest queued job (or a stale one), or null
 *   POST /v1/jobs/<id>/progress     { claim_token, progress, stage, log } → { continue } (false = cancelled)
 *   POST /v1/jobs/<id>/upload-start { claim_token, file_name, size_bytes } → one-time upload URL for the plan
 *   POST /v1/jobs/<id>/stills-upload { claim_token }                 → signed upload URL for the still-preview sheet
 *   POST /v1/jobs/<id>/usage        { claim_token, shots: [{ file_key, in, out }] } → footage usage for the plan
 *   POST /v1/jobs/<id>/finish       { claim_token, ok, result, error, log, final? }  final: do not retry
 */

const MCP_PUBLIC_URL = (Deno.env.get("MCP_PUBLIC_URL") ?? "https://mcp.synckerja.com").replace(/\/+$/, "");
const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

const BUCKET = "catalog-media";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function fail(status: number, code: string, message: string): Response {
  return json({ ok: false, code, message }, status);
}

Deno.serve(async (req) => {
  if (req.headers.get("Origin")) {
    return fail(403, "browser_request_rejected", "agent-api hanya untuk program Agent, bukan browser.");
  }

  const token = extractAgentToken(req.headers.get("Authorization"));
  if (!token) return fail(401, "unauthorized", "Token Agent tidak ada atau formatnya salah.");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: authRow, error: authError } = await admin.rpc("agent_auth", { p_token_hash: await sha256Hex(token) });
  if (authError) {
    console.error("agent_auth failed", authError.message);
    return fail(500, "internal_error", "Gagal cek token.");
  }
  const ctx = parseAuthRow(authRow);
  if (!ctx) return fail(401, "unauthorized", "Token Agent tidak dikenali, dicabut, atau kadaluarsa.");

  const path = routePath(new URL(req.url).pathname);

  try {
    if (req.method === "GET" && path === "/v1/whoami") {
      const { data: org } = await admin.from("organizations").select("name").eq("id", ctx.organizationId).maybeSingle();
      return json({
        ok: true,
        organization_id: ctx.organizationId,
        organization_name: (org as { name?: string } | null)?.name ?? null,
        scopes: ctx.scopes,
        expires_at: ctx.expiresAt,
      });
    }

    // Tray "Cek versi baru": the laptop only has its org token, never a GitHub token.
    if (req.method === "GET" && path === "/v1/release") {
      try {
        const r = await latestAgentRelease(Deno.env.get("AGENT_RELEASE_GITHUB_TOKEN") ?? "", ["zip"]);
        return json({ ok: true, version: r.version, published_at: r.publishedAt, zip_url: r.zipUrl });
      } catch (e) {
        if (e instanceof AgentReleaseError) {
          console.error("agent release", e.code, e.message);
          return fail(e.code === "not_configured" ? 503 : 502, e.code, e.message);
        }
        throw e;
      }
    }

    if (req.method === "POST" && path === "/v1/heartbeat") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return fail(400, "invalid_json", "Body harus JSON.");
      }
      const parsed = parseHeartbeat(body, req.headers.get("X-Agent-Device"));
      if (!parsed.ok) return fail(400, "invalid_input", parsed.error);
      const h = parsed.value;
      const outdated = versionOlderThan(h.agentVersion, AGENT_MIN_VERSION);
      const { data, error } = await admin.rpc("agent_heartbeat", {
        p_token_id: ctx.tokenId,
        p_device_key: h.deviceKey,
        p_name: h.name,
        p_agent_version: h.agentVersion,
        p_platform: h.platform,
        p_tools: h.tools,
        p_last_error: h.lastError,
      });
      if (error) {
        if (error.message.includes("token_inactive")) return fail(401, "unauthorized", "Token sudah tidak aktif.");
        if (error.message.includes("invalid_input")) return fail(400, "invalid_input", "Data heartbeat tidak valid.");
        console.error("agent_heartbeat failed", error.message);
        return fail(500, "internal_error", "Gagal simpan heartbeat.");
      }
      const marked = await admin.from("agent_devices").update({ update_required: outdated }).eq("device_key", h.deviceKey);
      if (marked.error) console.error("update_required", marked.error.message);
      return json({
        ok: true,
        ...(data as Record<string, unknown>),
        update_required: outdated,
        min_version: AGENT_MIN_VERSION,
      });
    }

    if (versionOlderThan(req.headers.get("X-Agent-Version"), AGENT_MIN_VERSION)) {
      return json(
        {
          ok: false,
          code: "update_required",
          message: "Agent ini perlu memasang rilis yang lebih baru.",
          min_version: AGENT_MIN_VERSION,
        },
        426,
      );
    }

    if (req.method === "GET" && path === "/v1/footage/file-tasks") {
      if (!ctx.scopes.includes("catalog")) return fail(403, "forbidden", "Token ini tidak punya akses katalog.");
      const { data, error } = await admin.rpc("agent_footage_file_tasks", { p_token_id: ctx.tokenId });
      if (error) {
        const m = mapRpcError(error.message);
        if (m.status === 500) console.error("agent_footage_file_tasks", error.message);
        return fail(m.status, m.code, "Gagal baca tugas file.");
      }
      return json({ ok: true, ...(data as Record<string, unknown>) });
    }

    if (req.method === "GET" && (path === "/v1/catalog/context" || path === "/v1/footage/untagged" || path === "/v1/footage/movable")) {
      if (!ctx.scopes.includes("catalog")) return fail(403, "forbidden", "Token ini tidak punya akses katalog.");
      if (path === "/v1/footage/movable") {
        const { data, error } = await admin.rpc("agent_footage_movable", { p_token_id: ctx.tokenId });
        if (error) {
          const m = mapRpcError(error.message);
          if (m.status === 500) console.error("agent_footage_movable", error.message);
          return fail(m.status, m.code, "Gagal baca daftar pindahan.");
        }
        return json({ ok: true, ...(data as Record<string, unknown>) });
      }
      if (path === "/v1/footage/untagged") {
        const { data, error } = await admin.rpc("agent_footage_untagged", { p_token_id: ctx.tokenId, p_limit: 10 });
        if (error) {
          const m = mapRpcError(error.message);
          return fail(m.status, m.code, "Gagal baca antrian tag.");
        }
        return json({ ok: true, ...(data as Record<string, unknown>) });
      }
      const { data, error } = await admin.rpc("agent_catalog_context", { p_token_id: ctx.tokenId });
      if (error) {
        const m = mapRpcError(error.message);
        if (m.status === 500) console.error("agent_catalog_context", error.message);
        return fail(m.status, m.code, "Gagal baca konteks katalog.");
      }
      const c = data as Record<string, unknown> & { location_thumbs?: Array<{ location: string; path: string }> };
      const thumbs = c.location_thumbs ?? [];
      const signed = thumbs.length
        ? await admin.storage.from(BUCKET).createSignedUrls(thumbs.map((t) => t.path), 3600)
        : { data: [] as Array<{ signedUrl: string | null }> };
      return json({
        ok: true,
        ...c,
        location_thumbs: thumbs
          .map((t, i) => ({ location: t.location, url: signed.data?.[i]?.signedUrl ?? null }))
          .filter((t) => t.url),
      });
    }

    const jobRoute = /^\/v1\/jobs\/(claim|([0-9a-f-]{36})\/(progress|finish|upload-start|usage|stills-upload))$/i.exec(path);
    if (req.method === "POST" && jobRoute) {
      if (!ctx.scopes.includes("render")) return fail(403, "forbidden", "Token ini tidak punya akses render.");
      let body: Record<string, unknown> = {};
      try {
        body = ((await req.json()) ?? {}) as Record<string, unknown>;
      } catch {
        body = {};
      }
      const rpcErr = (fn: string, message: string) => {
        const m = mapRpcError(message);
        if (m.status === 500) console.error(fn, message);
        return fail(m.status, m.code, m.status === 500 ? "Gagal simpan ke Synckerja." : m.code);
      };

      if (jobRoute[1] === "claim") {
        const device = req.headers.get("X-Agent-Device") ?? "";
        if (!isUuid(device)) return fail(400, "invalid_input", "X-Agent-Device harus UUID.");
        const { data, error } = await admin.rpc("agent_job_claim", { p_token_id: ctx.tokenId, p_device_key: device });
        if (error) return rpcErr("agent_job_claim", error.message);
        return json({ ok: true, ...(data as Record<string, unknown>) });
      }

      const jobId = jobRoute[2]!;
      const action = jobRoute[3]!.toLowerCase();
      const claimToken = body.claim_token;
      if (!isUuid(jobId) || !isUuid(claimToken)) return fail(400, "invalid_input", "job id dan claim_token harus UUID.");
      const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(-max) : null);

      if (action === "progress") {
        const progress = typeof body.progress === "number" && Number.isFinite(body.progress) ? Math.round(body.progress) : null;
        const { data, error } = await admin.rpc("agent_job_progress", {
          p_token_id: ctx.tokenId, p_job_id: jobId, p_claim_token: claimToken,
          p_progress: progress, p_stage: text(body.stage, 80), p_log: text(body.log, 20000),
        });
        if (error) return rpcErr("agent_job_progress", error.message);
        return json({ ok: true, ...(data as Record<string, unknown>) });
      }

      if (action === "usage") {
        if (!Array.isArray(body.shots)) return fail(400, "invalid_input", "shots wajib array.");
        const { data, error } = await admin.rpc("agent_job_log_usage", {
          p_token_id: ctx.tokenId, p_job_id: jobId, p_claim_token: claimToken, p_shots: body.shots,
        });
        if (error) return rpcErr("agent_job_log_usage", error.message);
        return json({ ok: true, ...(data as Record<string, unknown>) });
      }

      if (action === "finish") {
        if (typeof body.ok !== "boolean") return fail(400, "invalid_input", "ok wajib boolean.");
        const result = body.result && typeof body.result === "object" && !Array.isArray(body.result) ? body.result : null;
        const { data, error } = await admin.rpc("agent_job_finish", {
          p_token_id: ctx.tokenId, p_job_id: jobId, p_claim_token: claimToken, p_ok: body.ok,
          p_result: result, p_error: text(body.error, 2000), p_log: text(body.log, 20000),
          // Only sent when true, so an Agent that never sends final keeps working before and after the migration.
          ...(body.final === true ? { p_final: true } : {}),
        });
        if (error) return rpcErr("agent_job_finish", error.message);
        return json({ ok: true, ...(data as Record<string, unknown>) });
      }

      if (action === "stills-upload") {
        // Still-preview sheet: one JPEG per job, so Claude and Office can see it without the laptop.
        const { data: target, error: tErr } = await admin.rpc("agent_job_stills_target", {
          p_token_id: ctx.tokenId, p_job_id: jobId, p_claim_token: claimToken,
        });
        if (tErr) return rpcErr("agent_job_stills_target", tErr.message);
        const t = target as { path: string | null; reason?: string };
        if (!t.path) return json({ ok: true, upload: null, reason: t.reason ?? "not_stills" });
        const { data: signed, error: sErr } = await admin.storage.from(BUCKET).createSignedUploadUrl(t.path, { upsert: true });
        if (sErr || !signed) {
          console.error("stills-upload sign", sErr?.message);
          return fail(500, "internal_error", "Gagal siapkan unggahan still.");
        }
        return json({ ok: true, upload: { path: t.path, upload_url: signed.signedUrl, max_bytes: 8 * 1024 * 1024 } });
      }

      // upload-start: a new version on the job's content plan, uploaded in the name of whoever confirmed the job.
      const fileName = typeof body.file_name === "string" ? body.file_name.trim().slice(0, 200) : "";
      const size = typeof body.size_bytes === "number" ? body.size_bytes : NaN;
      if (!fileName || !Number.isFinite(size) || size <= 0) return fail(400, "invalid_input", "file_name dan size_bytes wajib.");
      const { data: target, error: tErr } = await admin.rpc("agent_job_upload_target", {
        p_token_id: ctx.tokenId, p_job_id: jobId, p_claim_token: claimToken,
      });
      if (tErr) return rpcErr("agent_job_upload_target", tErr.message);
      const t = target as { plan_id: string | null; user_id?: string | null; reason?: string };
      if (!t.plan_id) return json({ ok: true, upload: null, reason: t.reason ?? "no_plan" });
      if (!t.user_id) return json({ ok: true, upload: null, reason: "no_user" });
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/content-plan-media-upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "start",
          plan_id: t.plan_id,
          file_name: fileName,
          mime_type: "video/mp4",
          size_bytes: size,
          organization_id: ctx.organizationId,
          mcp_user_id: t.user_id,
          internal_secret: Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "",
        }),
      });
      const up = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || typeof up.ticket !== "string") {
        return json({ ok: true, upload: null, reason: typeof up.error === "string" ? up.error : `upload_start_${res.status}` });
      }
      return json({
        ok: true,
        upload: {
          upload_url: `${MCP_PUBLIC_URL}/uploads/${up.ticket}`,
          chunk_bytes: UPLOAD_CHUNK_BYTES,
          version_no: up.version_no,
          folder_url: up.folder_url,
          expires_at: up.expires_at,
        },
      });
    }

    if (req.method === "POST" && path.startsWith("/v1/footage/")) {
      if (!ctx.scopes.includes("catalog")) return fail(403, "forbidden", "Token ini tidak punya akses katalog.");
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return fail(400, "invalid_json", "Body harus JSON.");
      }
      type RpcResult = { error: Response; data?: undefined } | { error?: undefined; data: Record<string, unknown> };
      const rpc = async (fn: string, args: Record<string, unknown>): Promise<RpcResult> => {
        const { data, error } = await admin.rpc(fn, { p_token_id: ctx.tokenId, ...args });
        if (error) {
          const m = mapRpcError(error.message);
          if (m.status === 500) console.error(fn, error.message);
          return { error: fail(m.status, m.code, m.status === 500 ? "Gagal simpan ke Synckerja." : m.code) };
        }
        return { data: data as Record<string, unknown> };
      };

      if (path === "/v1/footage/check") {
        const keys = parseFileKeys(body);
        if (!keys) return fail(400, "invalid_input", "file_keys harus array teks (maks 500).");
        const r = await rpc("agent_footage_check", { p_file_keys: keys });
        return r.error ?? json({ ok: true, ...r.data });
      }

      if (path === "/v1/footage/register") {
        const clip = (body as Record<string, unknown> | null)?.clip;
        if (!clip || typeof clip !== "object" || Array.isArray(clip)) return fail(400, "invalid_input", "clip wajib object.");
        const r = await rpc("agent_footage_register", { p_input: clip });
        return r.error ?? json({ ok: true, ...r.data });
      }

      if (path === "/v1/footage/media-upload") {
        const assetId = (body as Record<string, unknown> | null)?.asset_id;
        if (!isUuid(assetId)) return fail(400, "invalid_input", "asset_id harus UUID.");
        const r = await rpc("agent_footage_media_targets", { p_asset_id: assetId });
        if (r.error) return r.error;
        const t = r.data as {
          preview_path: string | null;
          scenes: Array<{ scene_id: string; scene_index: number; start_seconds: number; end_seconds: number | null; thumb_path: string }>;
        };
        const sign = async (objectPath: string) => {
          const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(objectPath, { upsert: true });
          if (error || !data) throw new Error(`sign ${objectPath}: ${error?.message ?? "no data"}`);
          return data.signedUrl;
        };
        return json({
          ok: true,
          asset_id: assetId,
          max_bytes: 5 * 1024 * 1024,
          preview: t.preview_path ? { path: t.preview_path, upload_url: await sign(t.preview_path) } : null,
          scenes: await Promise.all(
            t.scenes.map(async (s) => ({
              scene_id: s.scene_id,
              scene_index: s.scene_index,
              start_seconds: Number(s.start_seconds),
              end_seconds: s.end_seconds === null ? null : Number(s.end_seconds),
              path: s.thumb_path,
              upload_url: await sign(s.thumb_path),
            })),
          ),
        });
      }

      if (path === "/v1/footage/tags") {
        const b = body as Record<string, unknown> | null;
        if (!isUuid(b?.asset_id) || !b?.tags || typeof b.tags !== "object" || Array.isArray(b.tags)) {
          return fail(400, "invalid_input", "asset_id (UUID) dan tags (object) wajib.");
        }
        const r = await rpc("agent_footage_tags", { p_asset_id: b.asset_id, p_input: b.tags });
        return r.error ?? json({ ok: true, ...r.data });
      }

      if (path === "/v1/footage/file-task") {
        const b = body as Record<string, unknown> | null;
        const result = b?.result;
        const allowed = result === "held" || result === "missing" || result === "back" || result === "purged";
        if (!isUuid(b?.asset_id) || !allowed) {
          return fail(400, "invalid_input", "asset_id (UUID) dan result (held|missing|back|purged) wajib.");
        }
        if (b.hold_key != null && (typeof b.hold_key !== "string" || b.hold_key.length > 250)) {
          return fail(400, "invalid_input", "hold_key tidak valid.");
        }
        const r = await rpc("agent_footage_file_task_done", {
          p_asset_id: b.asset_id,
          p_result: result,
          p_hold_key: typeof b.hold_key === "string" ? b.hold_key : null,
        });
        return r.error ?? json({ ok: true, ...r.data });
      }

      if (path === "/v1/footage/moved") {
        const b = body as Record<string, unknown> | null;
        if (!isUuid(b?.asset_id) || typeof b?.new_file_key !== "string" || b.new_file_key.length > 2000) {
          return fail(400, "invalid_input", "asset_id (UUID) dan new_file_key wajib.");
        }
        const r = await rpc("agent_footage_moved", { p_asset_id: b.asset_id, p_new_file_key: b.new_file_key });
        return r.error ?? json({ ok: true, ...r.data });
      }

      if (path === "/v1/footage/media-done") {
        const d = parseMediaDone(body);
        if (!d) return fail(400, "invalid_input", "asset_id, preview, scene_ids tidak valid.");
        const r = await rpc("agent_footage_media_done", {
          p_asset_id: d.assetId,
          p_preview: d.preview,
          p_scene_ids: d.sceneIds,
        });
        return r.error ?? json({ ok: true, ...r.data });
      }
    }

    return fail(404, "not_found", `Endpoint ${req.method} ${path} tidak ada.`);
  } catch (e) {
    console.error("agent-api error", e instanceof Error ? e.message : String(e));
    return fail(500, "internal_error", "Terjadi kesalahan.");
  }
});
