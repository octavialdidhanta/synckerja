import { describe, expect, it } from "vitest";
import { replaceStorageLinksInText, storagePathFromUrl, storagePathsInText } from "./storageLinks";

const BASE = "https://wqdzqqshoifwyrltzgvx.supabase.co/storage/v1/object";

describe("storage links in stored text", () => {
  it("reads paths from public and signed links of one bucket only", () => {
    expect(storagePathFromUrl(`${BASE}/public/task-files/task-step-files/s1/1.pdf`, "task-files")).toBe("task-step-files/s1/1.pdf");
    expect(storagePathFromUrl(`${BASE}/sign/task-files/s1/a%20b.png?token=t`, "task-files")).toBe("s1/a b.png");
    expect(storagePathFromUrl(`${BASE}/public/whatsapp-media/x.png`, "task-files")).toBeNull();
    expect(storagePathFromUrl(`${BASE}/public/task-files/..%2Fsecret`, "task-files")).toBeNull();
  });

  it("finds and swaps image links inside description HTML, leaving other links", () => {
    const a = `${BASE}/public/task-files/task-step-description-images/org-1/pending/1.png`;
    const b = `${BASE}/sign/task-files/task-step-description-images/s2/2.png?token=old`;
    const html = `<p><img src="${a}" alt=""></p><p><img src="${b}"></p><a href="https://example.com/x.png">x</a><img src="${a}">`;
    expect(storagePathsInText(html, "task-files")).toEqual([
      "task-step-description-images/org-1/pending/1.png",
      "task-step-description-images/s2/2.png",
    ]);
    const out = replaceStorageLinksInText(
      html,
      "task-files",
      new Map([
        ["task-step-description-images/org-1/pending/1.png", "SIGNED-A"],
        ["task-step-description-images/s2/2.png", "SIGNED-B"],
      ]),
    );
    expect(out).toBe(`<p><img src="SIGNED-A" alt=""></p><p><img src="SIGNED-B"></p><a href="https://example.com/x.png">x</a><img src="SIGNED-A">`);
  });

  it("keeps a link whose path was not signed", () => {
    const a = `${BASE}/public/task-files/s1/1.png`;
    expect(replaceStorageLinksInText(`<img src="${a}">`, "task-files", new Map([["other", "X"]]))).toBe(`<img src="${a}">`);
  });
});
