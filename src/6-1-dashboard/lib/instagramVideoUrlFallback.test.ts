import { describe, expect, it } from "vitest";
import { shouldFallbackFromInstagramVideoUrl } from "../../../supabase/functions/_shared/metaContent/instagramVideoUrlFallback.ts";

describe("shouldFallbackFromInstagramVideoUrl", () => {
  it("keeps polling a container Meta is still processing", () => {
    expect(shouldFallbackFromInstagramVideoUrl("media_not_ready: Instagram container status=IN_PROGRESS after 180000ms")).toBe(false);
  });

  it("uploads the file when Meta cannot fetch the Drive URL", () => {
    expect(shouldFallbackFromInstagramVideoUrl("meta_reels_container HTTP 400: Unable to fetch media from URL")).toBe(true);
    expect(shouldFallbackFromInstagramVideoUrl("meta_reels_container_error — The media could not be fetched")).toBe(true);
    expect(shouldFallbackFromInstagramVideoUrl("meta_reels_container_expired")).toBe(true);
  });
});
