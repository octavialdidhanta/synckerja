/** Threads carousel: one item container per photo, then one carousel container, then threads_publish. */

import { CAROUSEL_PUBLISH_IMAGE_LIMIT } from "../tiktokCarouselImageUrl.ts";
import type { ThreadsImageGraphCaller } from "./threadsImagePublish.ts";

const TEXT_LIMIT = 500;
const MIN_ITEMS = 2;
const STATUS_ATTEMPTS = 15;
const STATUS_DELAY_MS = 2000;

export type ThreadsCarouselPublishInput = {
  threadsUserId: string;
  imageUrls: string[];
  text?: string;
};

export type ThreadsCarouselPublishResult = {
  mediaId: string;
  permalink: string;
  threadsPublishPath: "carousel";
};

function mediaNotReady(message: string): boolean {
  return /not ready|not available|in_progress|does not exist/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilReady(graph: ThreadsImageGraphCaller, creationId: string): Promise<void> {
  let lastStatus = "";
  for (let attempt = 0; attempt < STATUS_ATTEMPTS; attempt++) {
    const row = await graph.get(creationId, { fields: "status,error_message" });
    const status = String(row.status ?? "").trim().toUpperCase();
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      const detail = String(row.error_message ?? "").trim();
      throw new Error(detail || `threads_container_${status.toLowerCase()}`);
    }
    lastStatus = status || "unknown";
    if (attempt < STATUS_ATTEMPTS - 1) await sleep(STATUS_DELAY_MS);
  }
  throw new Error(`threads_container_not_ready:${lastStatus}`);
}

async function publishCreation(
  graph: ThreadsImageGraphCaller,
  threadsUserId: string,
  creationId: string,
): Promise<{ id?: string }> {
  const path = `${threadsUserId}/threads_publish`;
  const body = { creation_id: creationId };
  try {
    return await graph.post(path, body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!mediaNotReady(message)) throw error;
    return await graph.post(path, body);
  }
}

export async function publishThreadsCarousel(
  input: ThreadsCarouselPublishInput,
  graph: ThreadsImageGraphCaller,
): Promise<ThreadsCarouselPublishResult> {
  const threadsUserId = String(input.threadsUserId ?? "").trim();
  const imageUrls = (input.imageUrls ?? []).map((url) => String(url ?? "").trim()).filter(Boolean);
  if (!threadsUserId) throw new Error("threads_user_id_required");
  if (imageUrls.length < MIN_ITEMS || imageUrls.length > CAROUSEL_PUBLISH_IMAGE_LIMIT) {
    throw new Error("threads_carousel_count");
  }
  if (imageUrls.some((url) => !url.startsWith("https://"))) {
    throw new Error("image_url_https_required");
  }

  console.log("threads_publish_path=carousel");

  const childIds: string[] = [];
  for (const imageUrl of imageUrls) {
    const item = await graph.post(`${threadsUserId}/threads`, {
      media_type: "IMAGE",
      image_url: imageUrl,
      is_carousel_item: "true",
    });
    const itemId = String(item.id ?? "").trim();
    if (!itemId) throw new Error("threads_container_id_missing");
    await waitUntilReady(graph, itemId);
    childIds.push(itemId);
  }

  const carouselBody: Record<string, string> = {
    media_type: "CAROUSEL",
    children: childIds.join(","),
  };
  const text = String(input.text ?? "").trim().slice(0, TEXT_LIMIT);
  if (text) carouselBody.text = text;

  const carousel = await graph.post(`${threadsUserId}/threads`, carouselBody);
  const creationId = String(carousel.id ?? "").trim();
  if (!creationId) throw new Error("threads_container_id_missing");
  await waitUntilReady(graph, creationId);

  const published = await publishCreation(graph, threadsUserId, creationId);
  const mediaId = String(published.id ?? "").trim();
  if (!mediaId) throw new Error("threads_media_id_missing");

  const media = await graph.get(mediaId, { fields: "id,permalink" });
  const permalink = String(media.permalink ?? "").trim();
  if (!permalink) throw new Error("threads_permalink_missing");

  return { mediaId, permalink, threadsPublishPath: "carousel" };
}
