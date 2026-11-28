import { describe, expect, it } from "vitest";
import { kolPhotoPathFromUrl } from "./kolPhotoPath";

describe("kolPhotoPathFromUrl", () => {
  const base = "https://wqdzqqshoifwyrltzgvx.supabase.co/storage/v1/object/public/kol-profile-photos/";

  it("keeps the org folder so delete stays inside the member's organization", () => {
    expect(kolPhotoPathFromUrl(`${base}5fa70166-0a35-4f0d-94b3-54f19b3f8c30/kol-profiles/1.jpg`)).toBe(
      "5fa70166-0a35-4f0d-94b3-54f19b3f8c30/kol-profiles/1.jpg",
    );
    expect(kolPhotoPathFromUrl(`${base}kol-profiles/old.png`)).toBe("kol-profiles/old.png");
  });

  it("returns null for other buckets or bad links", () => {
    expect(kolPhotoPathFromUrl("https://x.supabase.co/storage/v1/object/public/other/a.jpg")).toBeNull();
    expect(kolPhotoPathFromUrl("not a url")).toBeNull();
  });
});
