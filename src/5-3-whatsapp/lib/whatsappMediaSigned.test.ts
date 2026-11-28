import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));

import { clearWhatsAppMediaCache, signWhatsAppMediaRows, whatsappMediaPath } from "./whatsappMediaSigned";

const BASE = "https://wqdzqqshoifwyrltzgvx.supabase.co/storage/v1/object";
const CONV = "11111111-2222-3333-4444-555555555555";

describe("whatsappMediaPath", () => {
  it("reads public and signed links of whatsapp-media", () => {
    expect(whatsappMediaPath(`${BASE}/public/whatsapp-media/inbound/${CONV}/abc.jpg`)).toBe(`inbound/${CONV}/abc.jpg`);
    expect(whatsappMediaPath(`${BASE}/sign/whatsapp-media/ig/${CONV}/1_a%20b.png?token=xyz`)).toBe(`ig/${CONV}/1_a b.png`);
  });

  it("ignores other buckets, other hosts' links and path tricks", () => {
    expect(whatsappMediaPath(`${BASE}/public/task-files/a.png`)).toBeNull();
    expect(whatsappMediaPath("https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1")).toBeNull();
    expect(whatsappMediaPath(`${BASE}/public/whatsapp-media/..%2F..%2Fx`)).toBeNull();
    expect(whatsappMediaPath(null)).toBeNull();
  });
});

describe("signWhatsAppMediaRows", () => {
  beforeEach(() => clearWhatsAppMediaCache());

  it("swaps stored links for signed ones and reuses them until close to expiry", async () => {
    let now = 1_000_000;
    const signer = vi.fn(async (paths: string[]) => paths.map((path) => ({ path, signedUrl: `signed:${path}:${now}` })));
    const rows = [
      { id: 1, media_url: `${BASE}/public/whatsapp-media/inbound/${CONV}/a.jpg` },
      { id: 2, media_url: "https://cdn.example.com/x.jpg" },
      { id: 3, media_url: null },
    ];
    const first = await signWhatsAppMediaRows(rows, signer, () => now);
    expect(first[0].media_url).toBe(`signed:inbound/${CONV}/a.jpg:1000000`);
    expect(first[1].media_url).toBe("https://cdn.example.com/x.jpg");
    expect(first[2].media_url).toBeNull();
    expect(signer).toHaveBeenCalledTimes(1);

    now += 60 * 60 * 1000; // 1 h later: 5 h left, reused
    const second = await signWhatsAppMediaRows(rows, signer, () => now);
    expect(second[0].media_url).toBe(first[0].media_url);
    expect(signer).toHaveBeenCalledTimes(1);

    now += 4.5 * 60 * 60 * 1000; // 30 min left: signed again
    const third = await signWhatsAppMediaRows(rows, signer, () => now);
    expect(third[0].media_url).not.toBe(first[0].media_url);
    expect(signer).toHaveBeenCalledTimes(2);
  });

  it("keeps the stored link when signing fails", async () => {
    const rows = [{ media_url: `${BASE}/public/whatsapp-media/${CONV}/b.mp4` }];
    const out = await signWhatsAppMediaRows(rows, async () => { throw new Error("rls"); });
    expect(out[0].media_url).toBe(rows[0].media_url);
  });
});
