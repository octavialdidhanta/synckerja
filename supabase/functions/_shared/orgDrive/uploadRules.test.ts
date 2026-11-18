import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { nextVersionNo, randomTicket, secretMatches, sha256Hex, uploadBlockReason, uploadedFileProblem } from "./uploadRules.ts";

const base = { organization_id: "o", approved: true, production_approved: false, content_type_name: "Reel" };

Deno.test("upload gates follow the Office Drive link cell", () => {
  assertEquals(uploadBlockReason(base), null);
  assertEquals(uploadBlockReason({ ...base, approved: false }), "not_approved");
  assertEquals(uploadBlockReason({ ...base, approved: null }), "not_approved");
  assertEquals(uploadBlockReason({ ...base, production_approved: true }), "production_locked");
  assertEquals(uploadBlockReason({ ...base, content_type_name: "Carousel" }), "not_video_content");
  assertEquals(uploadBlockReason({ ...base, content_type_name: "post" }), "not_video_content");
  assertEquals(uploadBlockReason({ ...base, content_type_name: "Story" }), null);
  assertEquals(uploadBlockReason({ ...base, content_type_name: null }), null);
});

Deno.test("uploaded file must belong to this version", () => {
  const ok = { size: 100, parents: ["F"], appProperties: { v: "V1" }, trashed: false };
  const check = { versionId: "V1", folderId: "F", expectedBytes: 100, meta: ok };
  assertEquals(uploadedFileProblem(check, "v"), null);
  assertEquals(uploadedFileProblem({ ...check, meta: null }, "v"), "file_not_found");
  assertEquals(uploadedFileProblem({ ...check, meta: { ...ok, trashed: true } }, "v"), "file_trashed");
  assertEquals(uploadedFileProblem({ ...check, meta: { ...ok, appProperties: { v: "V2" } } }, "v"), "file_not_for_this_version");
  assertEquals(uploadedFileProblem({ ...check, meta: { ...ok, appProperties: {} } }, "v"), "file_not_for_this_version");
  assertEquals(uploadedFileProblem({ ...check, meta: { ...ok, parents: ["X"] } }, "v"), "file_wrong_folder");
  assertEquals(uploadedFileProblem({ ...check, meta: { ...ok, size: 99 } }, "v"), "size_mismatch");
});

Deno.test("version numbers", () => {
  assertEquals(nextVersionNo([]), 1);
  assertEquals(nextVersionNo([1, 3, 2]), 4);
});

Deno.test("secrets and tickets", async () => {
  assertEquals(secretMatches("abc", "abc"), true);
  assertEquals(secretMatches("abd", "abc"), false);
  assertEquals(secretMatches("", ""), false);
  const t1 = randomTicket();
  const t2 = randomTicket();
  assertEquals(t1 === t2, false);
  assertEquals(/^[A-Za-z0-9_-]{43}$/.test(t1), true);
  assertEquals((await sha256Hex("abc")).length, 64);
  assertEquals(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
