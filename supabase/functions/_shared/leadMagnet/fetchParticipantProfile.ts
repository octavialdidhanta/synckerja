const META_GRAPH_VERSION = "v21.0";

export type ParticipantProfile = {
  username: string | null;
  name: string | null;
  isFollower: boolean | null;
};

export async function fetchParticipantProfile(
  scopedUserId: string,
  accessToken: string,
): Promise<ParticipantProfile> {
  const fields = "username,name,is_user_follow_business";
  const url =
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(scopedUserId)}?fields=${fields}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as {
      username?: string;
      name?: string;
      is_user_follow_business?: boolean;
      error?: { message?: string };
    };
    if (!res.ok) {
      console.warn("[lead-magnet] profile fetch failed:", data.error?.message ?? res.status);
      return { username: null, name: null, isFollower: null };
    }
    return {
      username: typeof data.username === "string" ? data.username : null,
      name: typeof data.name === "string" ? data.name : null,
      isFollower: typeof data.is_user_follow_business === "boolean" ? data.is_user_follow_business : null,
    };
  } catch (err) {
    console.warn("[lead-magnet] profile fetch error:", err);
    return { username: null, name: null, isFollower: null };
  }
}

export async function fetchCommentText(
  commentId: string,
  accessToken: string,
): Promise<{ text: string | null; username: string | null }> {
  const fields = "text,from,username";
  const url =
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(commentId)}?fields=${fields}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as {
      text?: string;
      username?: string;
      from?: { username?: string; name?: string };
      error?: { message?: string };
    };
    if (!res.ok) {
      console.warn("[lead-magnet] comment fetch failed:", data.error?.message ?? res.status);
      return { text: null, username: null };
    }
    const username = data.username ?? data.from?.username ?? null;
    return {
      text: typeof data.text === "string" ? data.text : null,
      username: typeof username === "string" ? username : null,
    };
  } catch (err) {
    console.warn("[lead-magnet] comment fetch error:", err);
    return { text: null, username: null };
  }
}
