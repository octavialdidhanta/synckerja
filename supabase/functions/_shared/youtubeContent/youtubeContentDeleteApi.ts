const YOUTUBE_DATA_API = "https://www.googleapis.com/youtube/v3";

export type YouTubeDeleteVideoResult =
  | { ok: true; alreadyDeleted: boolean }
  | { ok: false; error: string; status?: number };

export async function deleteYouTubeVideo(
  accessToken: string,
  videoId: string,
): Promise<YouTubeDeleteVideoResult> {
  const id = videoId.trim();
  if (!id) return { ok: false, error: "missing_video_id" };

  const url = new URL(`${YOUTUBE_DATA_API}/videos`);
  url.searchParams.set("id", id);

  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 204 || res.status === 200) {
    return { ok: true, alreadyDeleted: false };
  }

  if (res.status === 404) {
    return { ok: true, alreadyDeleted: true };
  }

  let message = `youtube_delete_failed_${res.status}`;
  try {
    const json = await res.json() as { error?: { message?: string } };
    if (json?.error?.message) message = json.error.message;
  } catch {
    // ignore
  }

  return { ok: false, error: message, status: res.status };
}
