import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  allowedUploadOrigin,
  isDriveId,
  normalizeVideoMime,
  parseSizeBytes,
  planFolderName,
  planShortId,
  versionFileName,
} from "./naming.ts";

Deno.test("plan short id and folder name", () => {
  const id = "bd995747-1234-4abc-9def-000000000000";
  assertEquals(planShortId(id), "bd995747");
  assertEquals(planFolderName(id, "Hari 5 – Rame Banget? Chat Dulu"), "bd995747 Hari 5 – Rame Banget Chat Dulu");
  assertEquals(planFolderName(id, "  a/b\\c:d*e  "), "bd995747 a b c d e");
  assertEquals(planFolderName(id, null), "bd995747");
  assertEquals(planFolderName(id, "x".repeat(200)).length, 8 + 1 + 80);
});

Deno.test("video mime and file names", () => {
  assertEquals(normalizeVideoMime("video/mp4"), "video/mp4");
  assertEquals(normalizeVideoMime("", "final_fix.MOV"), "video/quicktime");
  assertEquals(normalizeVideoMime("image/png", "a.png"), null);
  assertEquals(versionFileName(3, "video/mp4"), "v3.mp4");
  assertEquals(versionFileName(2, "video/quicktime"), "v2.mov");
});

Deno.test("size limits", () => {
  assertEquals(parseSizeBytes(13_700_000), 13_700_000);
  assertEquals(parseSizeBytes("13700000"), 13_700_000);
  assertEquals(parseSizeBytes(100), null);
  assertEquals(parseSizeBytes(600 * 1024 * 1024), null);
  assertEquals(parseSizeBytes(1.5), null);
  assertEquals(parseSizeBytes("abc"), null);
});

Deno.test("drive ids", () => {
  assertEquals(isDriveId("1eLD1zl7reMHz5Jjzkk3jStwVGTO-Rq39"), true);
  assertEquals(isDriveId("../etc"), false);
  assertEquals(isDriveId(""), false);
});

Deno.test("upload origin allow list", () => {
  const allow = ["https://office.synckerja.com"];
  assertEquals(allowedUploadOrigin("https://office.synckerja.com", allow), "https://office.synckerja.com");
  assertEquals(allowedUploadOrigin("https://office.synckerja.com/", allow), "https://office.synckerja.com");
  assertEquals(allowedUploadOrigin("http://localhost:8080", allow), "http://localhost:8080");
  assertEquals(allowedUploadOrigin("https://evil.example", allow), null);
  assertEquals(allowedUploadOrigin("javascript:alert(1)", allow), null);
  assertEquals(allowedUploadOrigin(null, allow), null);
});
