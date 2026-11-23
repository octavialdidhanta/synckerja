import { describe, expect, it } from "vitest";
import { createLocalFolder } from "./localFolder";

describe("createLocalFolder", () => {
  it("keeps one folder per organization, and none without an organization", async () => {
    const folderFor = createLocalFolder("referensi_dir", "referensi");
    expect(folderFor("org-a")).toBe(folderFor("org-a"));
    expect(folderFor("org-a")).not.toBe(folderFor("org-b"));
    await expect(folderFor(null).open("ref.mp4")).rejects.toThrow("no-folder");
    expect(await folderFor(undefined).listFiles()).toEqual([]);
  });
});
