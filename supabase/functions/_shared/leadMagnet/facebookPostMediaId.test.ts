import {
  canonicalFacebookPostMediaId,
  facebookPostMediaIdCandidates,
} from "./facebookPostMediaId.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("facebookPostMediaIdCandidates — full composite id", () => {
  const pageId = "106305844997969";
  const postId = "106305844997969_706511974987669";
  assertEquals(facebookPostMediaIdCandidates(postId, pageId).sort(), [
    "106305844997969_706511974987669",
    "706511974987669",
  ].sort());
});

Deno.test("facebookPostMediaIdCandidates — suffix-only webhook id", () => {
  const pageId = "106305844997969";
  const postId = "706511974987669";
  assertEquals(facebookPostMediaIdCandidates(postId, pageId).sort(), [
    "706511974987669",
    "106305844997969_706511974987669",
  ].sort());
});

Deno.test("canonicalFacebookPostMediaId — suffix to composite", () => {
  assertEquals(
    canonicalFacebookPostMediaId("706511974987669", "106305844997969"),
    "106305844997969_706511974987669",
  );
});

Deno.test("canonicalFacebookPostMediaId — already composite", () => {
  assertEquals(
    canonicalFacebookPostMediaId("106305844997969_706511974987669", "106305844997969"),
    "106305844997969_706511974987669",
  );
});
