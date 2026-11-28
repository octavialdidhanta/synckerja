import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));
vi.mock("@/shared/auth/hooks/useOrgBootstrapPending", () => ({ useOrgBootstrapPending: () => ({ organizationId: null }) }));

import { formatStorageBytes, groupStorageByModule, storageUsedPercent } from "./storageUsage";
import { rewriteQuotaRefusal, withStorageUploadMessages } from "./storageUploadErrors";

const MB = 1024 * 1024;
const GB = 1024 * MB;

describe("storage usage display", () => {
  it("groups buckets into modules, largest first, unknown into Lainnya", () => {
    const out = groupStorageByModule([
      { bucket: "catalog-media", bytes: 221 * MB, files: 1958 },
      { bucket: "whatsapp-media", bytes: 177 * MB, files: 333 },
      { bucket: "brief-visual-images", bytes: 50 * MB, files: 100 },
      { bucket: "social-media-carousel", bytes: 60 * MB, files: 200 },
      { bucket: "mystery-bucket", bytes: 1 * MB, files: 1 },
    ]);
    expect(out.map((m) => m.key)).toEqual(["footage", "chat", "content", "other"]);
    expect(out[2]).toMatchObject({ label: "Konten & brief", bytes: 110 * MB, files: 300 });
    expect(out[3].label).toBe("Lainnya");
  });

  it("formats sizes and percent the Indonesian way", () => {
    expect(formatStorageBytes(527 * MB)).toBe("527 MB");
    expect(formatStorageBytes(5 * GB)).toBe("5,0 GB");
    expect(formatStorageBytes(12 * GB)).toBe("12 GB");
    expect(storageUsedPercent({ used_bytes: 527 * MB, quota_bytes: 5 * GB })).toBe(10.3);
    expect(storageUsedPercent({ used_bytes: 6 * GB, quota_bytes: 5 * GB })).toBe(100);
    expect(storageUsedPercent({ used_bytes: 1, quota_bytes: 0 })).toBe(0);
  });
});

describe("upload refused because storage is full", () => {
  const rls = () =>
    new Response(JSON.stringify({ statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  const url = "https://x.supabase.co/storage/v1/object/task-files/s1/a.png";
  const init = { method: "POST", headers: { authorization: "Bearer jwt", apikey: "anon" } };

  it("says the organization is full when get_storage_usage reports full", async () => {
    const calls: Array<{ url: string; auth: string | null }> = [];
    const fetcher = (async (input: RequestInfo | URL, req?: RequestInit) => {
      calls.push({ url: String(input), auth: new Headers(req?.headers).get("authorization") });
      return new Response(JSON.stringify({ status: "full", used_bytes: 5 * GB, quota_bytes: 5 * GB }), { status: 200 });
    }) as typeof fetch;
    const out = await rewriteQuotaRefusal(rls(), url, init, fetcher);
    const body = await out.json();
    expect(body.error).toBe("storage_quota_full");
    expect(body.message).toBe("Penyimpanan organisasi penuh (5 GB dari 5 GB). Hapus file lama atau upgrade paket di menu Langganan.");
    expect(calls).toEqual([{ url: "https://x.supabase.co/rest/v1/rpc/get_storage_usage", auth: "Bearer jwt" }]);
  });

  it("keeps the RLS error when there is room (a real permission problem)", async () => {
    const fetcher = (async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })) as typeof fetch;
    const out = await rewriteQuotaRefusal(rls(), url, init, fetcher);
    expect((await out.json()).message).toContain("row-level security");
  });

  it("the client wrapper runs the quota check only for refused uploads", async () => {
    let usageCalls = 0;
    const base = (async (input: RequestInfo | URL) => {
      if (String(input).includes("/rpc/get_storage_usage")) {
        usageCalls += 1;
        return new Response(JSON.stringify({ status: "full", used_bytes: 2 * GB, quota_bytes: 2 * GB }), { status: 200 });
      }
      return rls();
    }) as typeof fetch;
    const wrapped = withStorageUploadMessages(base);
    const upload = await wrapped(url, init);
    expect((await upload.json()).error).toBe("storage_quota_full");
    const rest = await wrapped("https://x.supabase.co/rest/v1/tasks", { method: "POST" });
    expect((await rest.json()).message).toContain("row-level security");
    expect(usageCalls).toBe(1);
  });
});
