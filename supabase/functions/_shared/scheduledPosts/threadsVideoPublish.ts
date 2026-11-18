/** One Threads video: container, wait until FINISHED, then threads_publish. */

import type { ThreadsImageGraphCaller } from "./threadsImagePublish.ts";

const TEXT_LIMIT = 500;
const STATUS_ATTEMPTS = 10;
const STATUS_DELAY_MS = 15000;

export type ThreadsVideoPublishInput = {
  threadsUserId: string;
  videoUrl: string;
  text?: string;
};

export type ThreadsVideoPublishResult = {
  mediaId: string;
  permalink: string;
  threadsPublishPath: "video";
};

function mediaNotReady(message: string): boolean {
  return /not ready|not available|in_progress|does not exist/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilVideoReady(graph: ThreadsImageGraphCaller, creationId: string): Promise<void> {
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

export async function publishThreadsVideo(
  input: ThreadsVideoPublishInput,
  graph: ThreadsImageGraphCaller,
): Promise<ThreadsVideoPublishResult> {
  const threadsUserId = String(input.threadsUserId ?? "").trim();
  const videoUrl = String(input.videoUrl ?? "").trim();
  if (!threadsUserId) throw new Error("threads_user_id_required");
  if (!videoUrl.startsWith("https://")) throw new Error("video_url_https_required");

  console.log("threads_publish_path=video");

  const containerBody: Record<string, string> = {
    media_type: "VIDEO",
    video_url: videoUrl,
  };
  const text = String(input.text ?? "").trim().slice(0, TEXT_LIMIT);
  if (text) containerBody.text = text;

  const container = await graph.post(`${threadsUserId}/threads`, containerBody);
  const creationId = String(container.id ?? "").trim();
  if (!creationId) throw new Error("threads_container_id_missing");
  await waitUntilVideoReady(graph, creationId);

  const published = await publishCreation(graph, threadsUserId, creationId);
  const mediaId = String(published.id ?? "").trim();
  if (!mediaId) throw new Error("threads_media_id_missing");

  const media = await graph.get(mediaId, { fields: "id,permalink" });
  const permalink = String(media.permalink ?? "").trim();
  if (!permalink) throw new Error("threads_permalink_missing");

  return { mediaId, permalink, threadsPublishPath: "video" };
}
