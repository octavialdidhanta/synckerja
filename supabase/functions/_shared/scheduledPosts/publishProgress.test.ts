import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyFacebookReelStatus } from "../metaContent/metaFacebookReelsPublishApi.ts";
import { isTikTokResumeRow } from "./rateLimit/publishResume.ts";
import { classifyTikTokPublishProgress } from "../tiktokContent/tiktokContentPublishApi.ts";

Deno.test("classifyTikTokPublishProgress separates a finished upload from a lost one", () => {
  assertEquals(classifyTikTokPublishProgress({ status: "FAILED", fail_reason: "internal" }), "failed");
  assertEquals(classifyTikTokPublishProgress({ status: "PUBLISH_COMPLETE" }), "complete");
  assertEquals(
    classifyTikTokPublishProgress({
      status: "PUBLISH_COMPLETE",
      publicaly_available_post_id: ["7123456789012345678"],
    }),
    "complete",
  );
  assertEquals(
    classifyTikTokPublishProgress({ status: "PROCESSING_UPLOAD", uploaded_bytes: 1200 }),
    "uploaded",
  );
  assertEquals(classifyTikTokPublishProgress({ status: "PROCESSING_DOWNLOAD" }), "uploaded");
  assertEquals(
    classifyTikTokPublishProgress({ status: "PROCESSING_UPLOAD", uploaded_bytes: 0 }),
    "awaiting_bytes",
  );
  assertEquals(classifyTikTokPublishProgress({ status: "PROCESSING_UPLOAD" }), "awaiting_bytes");
});

Deno.test("classifyFacebookReelStatus does not finish a video that never received bytes", () => {
  assertEquals(
    classifyFacebookReelStatus({
      videoStatus: "processing",
      uploading: "not_started",
      processing: "not_started",
      publishing: "not_started",
    }),
    "upload_needed",
  );
  assertEquals(
    classifyFacebookReelStatus({
      videoStatus: "processing",
      uploading: "in_progress",
      processing: "not_started",
      publishing: "not_started",
    }),
    "upload_needed",
  );
  assertEquals(
    classifyFacebookReelStatus({
      videoStatus: "processing",
      uploading: "complete",
      processing: "in_progress",
      publishing: "not_started",
    }),
    "processing",
  );
  assertEquals(
    classifyFacebookReelStatus({
      videoStatus: "ready",
      uploading: "complete",
      processing: "complete",
      publishing: "complete",
    }),
    "published",
  );
  assertEquals(
    classifyFacebookReelStatus({
      videoStatus: "error",
      uploading: "error",
      processing: "not_started",
      publishing: "not_started",
    }),
    "error",
  );
});

Deno.test("TikTok resume includes an init whose bytes never finished", () => {
  assertEquals(
    isTikTokResumeRow({
      tiktok_publish_id: "v_pub_file~v2-1",
      tiktok_upload_completed: false,
    }),
    true,
  );
  assertEquals(isTikTokResumeRow({}), false);
});
