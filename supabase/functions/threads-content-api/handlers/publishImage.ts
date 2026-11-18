import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getThreadsAccessToken,
  requireActiveOrg,
  threadsContentJson,
} from "../../_shared/threadsContentAuth.ts";
import {
  createThreadsImageGraphCaller,
  publishThreadsSingleImage,
} from "../../_shared/scheduledPosts/threadsImagePublish.ts";

export async function handleThreadsPublishImageProbe(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return threadsContentJson({ error: "Missing organization_id" }, 400);

  const threadsUserId = String(body.threads_user_id ?? "").trim();
  if (!threadsUserId) return threadsContentJson({ error: "Missing threads_user_id" }, 400);

  const imageUrl = String(body.image_url ?? "").trim();
  if (!imageUrl) return threadsContentJson({ error: "Missing image_url" }, 400);

  const orgForbidden = await requireActiveOrg(admin, userId, organizationId);
  if (orgForbidden) return orgForbidden;

  const { data, error } = await admin
    .from("organization_instagram_accounts")
    .select("threads_user_id")
    .eq("organization_id", organizationId)
    .eq("threads_user_id", threadsUserId)
    .eq("has_threads", true)
    .eq("is_active", true)
    .limit(1);

  if (error) return threadsContentJson({ error: error.message }, 500);
  if (!data?.length) return threadsContentJson({ error: "threads_account_not_found" }, 404);

  const accessToken = await getThreadsAccessToken(admin, organizationId, threadsUserId);
  if (!accessToken) return threadsContentJson({ ok: false, reason: "no_token" }, 200);

  try {
    const published = await publishThreadsSingleImage(
      {
        threadsUserId,
        imageUrl,
        text: typeof body.text === "string" ? body.text : undefined,
      },
      createThreadsImageGraphCaller(accessToken),
    );
    return threadsContentJson({
      ok: true,
      threads_user_id: threadsUserId,
      media_id: published.mediaId,
      permalink: published.permalink,
      threads_publish_path: published.threadsPublishPath,
    }, 200);
  } catch (publishError) {
    const message = publishError instanceof Error ? publishError.message : String(publishError);
    return threadsContentJson({ ok: false, error: message }, 502);
  }
}
