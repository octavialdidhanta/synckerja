import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUCKET_LIMITS, bucketFromStorageUrl, storageRejection, storageRejectionMessage } from "./bucketLimits";
import { isStorageUpload, rewriteStorageRejection, withStorageUploadMessages } from "./storageUploadErrors";

const BASE = "https://x.supabase.co/storage/v1/object";

describe("bucket limits", () => {
  it("match the migration exactly (one UPDATE per bucket, same size and types)", () => {
    const sql = readFileSync("supabase/migrations/20261128130000_storage_bucket_limits.sql", "utf8");
    const updates = [...sql.matchAll(/UPDATE storage\.buckets SET file_size_limit = (\d+), allowed_mime_types = (NULL|ARRAY\[([^\]]*)\]::text\[\]) WHERE id = '([^']+)';/g)];
    const fromSql = Object.fromEntries(
      updates.map((m) => [m[4], { maxBytes: Number(m[1]), mimeTypes: m[2] === "NULL" ? null : [...m[3].matchAll(/'([^']*)'/g)].map((x) => x[1]) }]),
    );
    const fromTs = Object.fromEntries(Object.entries(BUCKET_LIMITS).map(([id, l]) => [id, { maxBytes: l.maxBytes, mimeTypes: l.mimeTypes }]));
    expect(fromSql).toEqual(fromTs);
  });

  it("approved sizes: WA 100 MB, recruitment 5 MB, attendance 2 MB, task 10 MB", () => {
    expect(BUCKET_LIMITS["whatsapp-media"]).toMatchObject({ maxBytes: 100 * 1024 * 1024, mimeTypes: null });
    expect(BUCKET_LIMITS["recruitment-files"].maxBytes).toBe(5 * 1024 * 1024);
    expect(BUCKET_LIMITS["attendance-photos"].maxBytes).toBe(2 * 1024 * 1024);
    expect(BUCKET_LIMITS["task-files"].maxBytes).toBe(10 * 1024 * 1024);
    // No SVG anywhere: public buckets would serve scripts.
    for (const limit of Object.values(BUCKET_LIMITS)) expect(limit.mimeTypes ?? []).not.toContain("image/svg+xml");
  });

  it("reads the bucket from upload URLs only", () => {
    expect(bucketFromStorageUrl(`${BASE}/task-files/a/b.png`)).toBe("task-files");
    expect(bucketFromStorageUrl(`${BASE}/upload/sign/recruitment-files/apply/x.pdf?token=1`)).toBe("recruitment-files");
    expect(bucketFromStorageUrl(`${BASE}/public/task-files/a.png`)).toBeNull();
    expect(bucketFromStorageUrl("https://x.supabase.co/rest/v1/tasks")).toBeNull();
  });

  it("classifies Supabase refusals and words them in Indonesian", () => {
    expect(storageRejection(400, { statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" })).toBe("too_large");
    expect(storageRejection(413, {})).toBe("too_large");
    expect(storageRejection(400, { statusCode: "415", error: "invalid_mime_type", message: "mime type image/svg+xml is not supported" })).toBe("bad_type");
    expect(storageRejection(400, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" })).toBeNull();
    expect(storageRejectionMessage("too_large", "recruitment-files")).toBe("File terlalu besar. Maksimal 5 MB.");
    expect(storageRejectionMessage("bad_type", "recruitment-files")).toBe("Jenis file tidak didukung. Gunakan PDF, DOC/DOCX, atau gambar.");
    expect(storageRejectionMessage("too_large", null)).toBe("File terlalu besar untuk diunggah.");
  });
});

describe("Office upload messages", () => {
  const tooLarge = () =>
    new Response(JSON.stringify({ statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });

  it("rewrites the message of a refused upload and keeps the status", async () => {
    const out = await rewriteStorageRejection(tooLarge(), `${BASE}/task-files/s1/big.zip`);
    expect(out.status).toBe(400);
    expect(await out.json()).toMatchObject({ statusCode: "413", error: "Payload too large", message: "File terlalu besar. Maksimal 10 MB." });
  });

  it("only touches failed uploads", async () => {
    const calls: string[] = [];
    const base: typeof fetch = async (input) => {
      calls.push(String(input));
      return tooLarge();
    };
    const wrapped = withStorageUploadMessages(base);
    const upload = await wrapped(`${BASE}/kol-profile-photos/o/k.png`, { method: "POST" });
    expect((await upload.json()).message).toBe("File terlalu besar. Maksimal 5 MB.");
    const rest = await wrapped("https://x.supabase.co/rest/v1/tasks", { method: "POST" });
    expect((await rest.json()).message).toBe("The object exceeded the maximum allowed size");
    const download = await wrapped(`${BASE}/sign/task-files/a.png?token=t`);
    expect((await download.json()).message).toBe("The object exceeded the maximum allowed size");
    expect(isStorageUpload(`${BASE}/task-files/a.png`, { method: "PUT" })).toBe(true);
    expect(calls).toHaveLength(3);
  });

  it("leaves non-JSON and unrelated errors alone", async () => {
    const html = new Response("<html>bad gateway</html>", { status: 502 });
    expect(await (await rewriteStorageRejection(html, `${BASE}/task-files/a`)).text()).toContain("bad gateway");
    const rls = new Response(JSON.stringify({ statusCode: "403", message: "new row violates row-level security policy" }), { status: 400 });
    expect((await (await rewriteStorageRejection(rls, `${BASE}/task-files/a`)).json()).message).toContain("row-level security");
  });
});
