import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  chunkProblem,
  listMediaVersions,
  parseContentRange,
  putUploadChunk,
  startMediaUpload,
  ticketHash,
} from "../src/db/mediaUpload";
import { MCP_TOOLS } from "../src/mcp/registry";
import { MEDIA_UPLOAD_CHUNK_BYTES, startMediaUploadInput } from "../src/tools/content/mediaUpload";

const me = { userId: "11111111-1111-4111-8111-111111111111", organizationId: "22222222-2222-4222-8222-222222222222" };
const planId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const config = {
  publicUrl: "https://mcp.synckerja.com",
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceRoleKey: "service-role",
  scheduledPostsInternalSecret: "internal-secret",
};
const TICKET = "a".repeat(43);
const MB = 1024 * 1024;

describe("media upload tools in the registry", () => {
  it("upload.start is a mutating content write, versions.list a read", () => {
    const start = MCP_TOOLS.find((t) => t.name === "content.plans.media.upload.start");
    const list = MCP_TOOLS.find((t) => t.name === "content.plans.media.versions.list");
    expect(start?.scopes).toEqual(["content:write"]);
    expect(start?.mutates).toBe(true);
    expect(start?.description).toContain("not_approved");
    expect(start?.description).toContain("production_locked");
    expect(list?.scopes).toEqual(["content:read"]);
    expect(list?.mutates).toBeFalsy();
  });

  it("validates input", () => {
    expect(startMediaUploadInput.safeParse({ plan_id: planId, file_name: "v.mp4", size_bytes: 13_700_000 }).success).toBe(true);
    expect(startMediaUploadInput.safeParse({ plan_id: planId, file_name: "v.mp4", size_bytes: 600 * MB }).success).toBe(false);
    expect(startMediaUploadInput.safeParse({ plan_id: "x", file_name: "v.mp4", size_bytes: 13_700_000 }).success).toBe(false);
    expect(startMediaUploadInput.safeParse({ plan_id: planId, file_name: "v.mp4", size_bytes: 1, extra: 1 }).success).toBe(false);
  });
});

describe("startMediaUpload", () => {
  it("calls the edge function as the session user and returns a Synckerja upload url", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({
        action: "start",
        plan_id: planId,
        organization_id: me.organizationId,
        mcp_user_id: me.userId,
        internal_secret: "internal-secret",
        mime_type: "video/mp4",
      });
      return Response.json({
        version_id: "v-id",
        version_no: 3,
        file_name: "v3.mp4",
        folder_url: "https://drive.google.com/drive/folders/F",
        ticket: TICKET,
        expires_at: "2026-11-18T10:00:00Z",
        size_bytes: 13_700_000,
      });
    });
    const res = await startMediaUpload(config, me, { planId, fileName: "final.mp4", sizeBytes: 13_700_000, mimeType: null }, fetchImpl as never);
    expect(res.upload_url).toBe(`https://mcp.synckerja.com/uploads/${TICKET}`);
    expect(res.version_no).toBe(3);
    expect(res.how_to_upload).toContain("Content-Range");
    expect(JSON.stringify(res)).not.toContain("googleapis");
  });

  it("passes known errors through and hides unknown ones", async () => {
    const blocked = vi.fn(async () => Response.json({ error: "production_locked" }, { status: 409 }));
    await expect(startMediaUpload(config, me, { planId, fileName: "a.mp4", sizeBytes: 20_000, mimeType: null }, blocked as never)).rejects.toThrow("production_locked");
    const weird = vi.fn(async () => Response.json({ error: "server_error", message: "https://secret" }, { status: 500 }));
    await expect(startMediaUpload(config, me, { planId, fileName: "a.mp4", sizeBytes: 20_000, mimeType: null }, weird as never)).rejects.toThrow("upload_start_failed");
  });
});

describe("content ranges and chunk rules", () => {
  it("parses ranges and allows a whole small file without a header", () => {
    expect(parseContentRange(null, 100, 100)).toEqual({ start: 0, end: 99, total: 100 });
    expect(parseContentRange(null, 50, 100)).toBe("invalid");
    expect(parseContentRange("bytes 0-49/100", 50, 100)).toEqual({ start: 0, end: 49, total: 100 });
    expect(parseContentRange("bytes 0-49/101", 50, 100)).toBe("invalid");
    expect(parseContentRange("bytes 0-60/100", 50, 100)).toBe("invalid");
    expect(parseContentRange("bytes 90-120/100", 31, 100)).toBe("invalid");
    expect(parseContentRange("junk", 50, 100)).toBe("invalid");
  });

  it("enforces order, size and 256 KiB granularity", () => {
    const total = 20 * MB;
    expect(chunkProblem({ start: 0, end: 8 * MB - 1, total }, 0)).toBeNull();
    expect(chunkProblem({ start: 8 * MB, end: 16 * MB - 1, total }, 0)).toBe("out_of_order");
    expect(chunkProblem({ start: 0, end: 9 * MB - 1, total }, 0)).toBe("chunk_too_large");
    expect(chunkProblem({ start: 0, end: 1000, total }, 0)).toBe("chunk_not_multiple_of_256k");
    expect(chunkProblem({ start: 16 * MB, end: total - 1, total }, 16 * MB)).toBeNull();
    expect(MEDIA_UPLOAD_CHUNK_BYTES % (256 * 1024)).toBe(0);
  });
});

function ticketAdmin(row: Record<string, unknown> | null) {
  const updates: Array<Record<string, unknown>> = [];
  const admin = {
    from: () => ({
      select: () => ({
        eq: (col: string, value: string) => {
          expect(col).toBe("ticket_hash");
          expect(value).toBe(ticketHash(TICKET));
          return { maybeSingle: async () => ({ data: row }) };
        },
      }),
      update: (u: Record<string, unknown>) => {
        updates.push(u);
        return { eq: async () => ({ error: null }) };
      },
    }),
  };
  return { admin, updates };
}

const baseRow = {
  id: "t1",
  version_id: "v-id",
  organization_id: me.organizationId,
  user_id: me.userId,
  google_upload_url: "https://www.googleapis.com/upload/drive/v3/files?upload_id=xyz",
  total_bytes: 20 * MB,
  received_bytes: 0,
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  completed_at: null,
};

describe("putUploadChunk", () => {
  it("forwards a middle chunk to Google and records progress", async () => {
    const { admin, updates } = ticketAdmin(baseRow);
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(baseRow.google_upload_url);
      expect((init.headers as Record<string, string>)["Content-Range"]).toBe(`bytes 0-${8 * MB - 1}/${20 * MB}`);
      return new Response(null, { status: 308, headers: { Range: `bytes=0-${8 * MB - 1}` } });
    });
    const res = await putUploadChunk(admin as never, config, TICKET, `bytes 0-${8 * MB - 1}/${20 * MB}`, new Uint8Array(8 * MB), fetchImpl as never);
    expect(res).toEqual({ status: 200, body: { received_bytes: 8 * MB, total_bytes: 20 * MB, done: false } });
    expect(updates).toEqual([{ received_bytes: 8 * MB }]);
  });

  it("finishes the version as the ticket owner after the last chunk", async () => {
    const { admin } = ticketAdmin({ ...baseRow, total_bytes: 1000, received_bytes: 0 });
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      if (url.startsWith("https://www.googleapis.com")) return Response.json({ id: "DRIVEFILE123" });
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({ action: "finish", version_id: "v-id", file_id: "DRIVEFILE123", apply_link: true, mcp_user_id: me.userId });
      return Response.json({ version_no: 3, google_drive_link: "https://drive.google.com/file/d/DRIVEFILE123/view", link_applied: true, production_status: "Need Review" });
    });
    const res = await putUploadChunk(admin as never, config, TICKET, null, new Uint8Array(1000), fetchImpl as never);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ done: true, version_no: 3, link_applied: true, production_status: "Need Review" });
  });

  it("rejects unknown, expired, finished tickets and out-of-order chunks without calling Google", async () => {
    const fetchImpl = vi.fn();
    expect((await putUploadChunk(ticketAdmin(null).admin as never, config, TICKET, null, new Uint8Array(10), fetchImpl as never)).status).toBe(404);
    const expired = ticketAdmin({ ...baseRow, expires_at: "2020-01-01T00:00:00Z" });
    expect((await putUploadChunk(expired.admin as never, config, TICKET, null, new Uint8Array(10), fetchImpl as never)).status).toBe(410);
    const done = ticketAdmin({ ...baseRow, completed_at: "2026-11-18T00:00:00Z" });
    expect((await putUploadChunk(done.admin as never, config, TICKET, null, new Uint8Array(10), fetchImpl as never)).status).toBe(409);
    const skip = ticketAdmin(baseRow);
    const res = await putUploadChunk(skip.admin as never, config, TICKET, `bytes ${8 * MB}-${16 * MB - 1}/${20 * MB}`, new Uint8Array(8 * MB), fetchImpl as never);
    expect(res.body).toMatchObject({ error: "out_of_order", received_bytes: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects malformed tickets before touching the database", async () => {
    const admin = { from: vi.fn() };
    const res = await putUploadChunk(admin as never, config, "../../etc", null, new Uint8Array(10), vi.fn() as never);
    expect(res.status).toBe(404);
    expect(admin.from).not.toHaveBeenCalled();
  });
});

describe("listMediaVersions", () => {
  it("only reads the session org and marks the active version", async () => {
    const calls: Array<[string, string]> = [];
    const chain = (data: unknown) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = (c: string, v: string) => (calls.push([c, v]), q);
      q.order = async () => ({ data, error: null });
      q.maybeSingle = async () => ({ data });
      return q;
    };
    const admin = {
      from: (table: string) =>
        table === "social_media_plans"
          ? chain({ id: planId, google_drive_link: "https://drive.google.com/file/d/FILE2/view?usp=drivesdk" })
          : chain([
            { version_no: 2, status: "ready", drive_file_id: "FILE2", drive_folder_id: "F", source: "mcp", size_bytes: 10, created_at: "c", completed_at: "d" },
            { version_no: 1, status: "ready", drive_file_id: "FILE1", drive_folder_id: "F", source: "web", size_bytes: 9, created_at: "a", completed_at: "b" },
          ]),
    };
    const res = await listMediaVersions(admin as never, me, planId);
    expect(res.versions.map((v) => [v.version_no, v.active])).toEqual([[2, true], [1, false]]);
    expect(calls).toContainEqual(["organization_id", me.organizationId]);
  });
});

describe("org drive migration", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261118090000_org_google_drive_media_versions.sql", import.meta.url), "utf8");
  it("keeps tokens and tickets away from browsers", () => {
    expect(sql).toContain("organization_google_drive_connection_tokens_deny");
    expect(sql).toContain("content_plan_media_upload_tickets_deny");
    expect(sql).toContain("ticket_hash text NOT NULL UNIQUE");
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*(anon|authenticated)/);
  });
  it("only production approvers can switch an approved plan", () => {
    expect(sql).toContain("IF NOT public.can_approve_content_production(p_user_id, v_version.organization_id)");
    expect(sql).toContain("column_type = 'prod_approved'");
    expect(sql).toContain("AND sp.status = 'pending'");
  });
});
