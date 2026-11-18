/** One Threads feed photo: container, then threads_publish. Not used by the scheduler. */

const THREADS_GRAPH_BASE = "https://graph.threads.net/v1.0";
const THREADS_IMAGE_TEXT_LIMIT = 500;
const IMAGE_STATUS_ATTEMPTS = 15;
const IMAGE_STATUS_DELAY_MS = 2000;

export type ThreadsImageGraphCaller = {
  post: (path: string, body: Record<string, string>) => Promise<{ id?: string }>;
  get: (
    path: string,
    params: Record<string, string>,
  ) => Promise<{ id?: string; permalink?: string; status?: string; error_message?: string }>;
};

export type ThreadsImagePublishInput = {
  threadsUserId: string;
  imageUrl: string;
  text?: string;
};

export type ThreadsImagePublishResult = {
  mediaId: string;
  permalink: string;
  threadsPublishPath: "image";
};

type GraphError = { error?: { message?: string } };

function mediaNotReady(message: string): boolean {
  return /not ready|not available|in_progress|does not exist/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilImageReady(
  graph: ThreadsImageGraphCaller,
  creationId: string,
): Promise<void> {
  let lastStatus = "";
  for (let attempt = 0; attempt < IMAGE_STATUS_ATTEMPTS; attempt++) {
    const row = await graph.get(creationId, { fields: "status,error_message" });
    const status = String(row.status ?? "").trim().toUpperCase();
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      const detail = String(row.error_message ?? "").trim();
      throw new Error(detail || `threads_container_${status.toLowerCase()}`);
    }
    lastStatus = status || "unknown";
    if (attempt < IMAGE_STATUS_ATTEMPTS - 1) await sleep(IMAGE_STATUS_DELAY_MS);
  }
  throw new Error(`threads_container_not_ready:${lastStatus}`);
}

function optionalText(text: string | undefined): string {
  return String(text ?? "").trim().slice(0, THREADS_IMAGE_TEXT_LIMIT);
}

export function createThreadsImageGraphCaller(accessToken: string): ThreadsImageGraphCaller {
  return {
    async post(path, body) {
      const res = await fetch(`${THREADS_GRAPH_BASE}/${path.replace(/^\/+/, "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ ...body, access_token: accessToken }).toString(),
      });
      const data = await res.json().catch(() => ({})) as { id?: string } & GraphError;
      if (!res.ok || data.error) {
        throw new Error(data.error?.message ?? `Threads API error ${res.status}`);
      }
      return data;
    },
    async get(path, params) {
      const qs = new URLSearchParams({ ...params, access_token: accessToken });
      const res = await fetch(`${THREADS_GRAPH_BASE}/${path.replace(/^\/+/, "")}?${qs.toString()}`);
      const data = await res.json().catch(() => ({})) as { id?: string; permalink?: string } & GraphError;
      if (!res.ok || data.error) {
        throw new Error(data.error?.message ?? `Threads API error ${res.status}`);
      }
      return data;
    },
  };
}

async function publishContainer(
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

export async function publishThreadsSingleImage(
  input: ThreadsImagePublishInput,
  graph: ThreadsImageGraphCaller,
): Promise<ThreadsImagePublishResult> {
  const threadsUserId = String(input.threadsUserId ?? "").trim();
  const imageUrl = String(input.imageUrl ?? "").trim();
  if (!threadsUserId) throw new Error("threads_user_id_required");
  if (!imageUrl.startsWith("https://")) throw new Error("image_url_https_required");

  console.log("threads_publish_path=image");

  const containerBody: Record<string, string> = {
    media_type: "IMAGE",
    image_url: imageUrl,
  };
  const text = optionalText(input.text);
  if (text) containerBody.text = text;

  let container: { id?: string };
  try {
    container = await graph.post(`${threadsUserId}/threads`, containerBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`threads_container: ${message}`);
  }
  const creationId = String(container.id ?? "").trim();
  if (!creationId) throw new Error("threads_container_id_missing");

  await waitUntilImageReady(graph, creationId);

  const published = await publishContainer(graph, threadsUserId, creationId);
  const mediaId = String(published.id ?? "").trim();
  if (!mediaId) throw new Error("threads_media_id_missing");

  const media = await graph.get(mediaId, { fields: "id,permalink" });
  const permalink = String(media.permalink ?? "").trim();
  if (!permalink) throw new Error("threads_permalink_missing");

  return { mediaId, permalink, threadsPublishPath: "image" };
}
