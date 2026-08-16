import { useQuery } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import type { MetaContentPlatform } from "@/meta-platform/types/metaContentTypes";

export type MetaPostLiker = {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
};

async function invokeComments(args: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("meta-content-comments", { body: args });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return data;
}

export function useMetaContentPostLikersQuery(args: {
  organizationId: string;
  platform: MetaContentPlatform;
  accountId: string;
  mediaId: string | null;
  enabled?: boolean;
}) {
  const { organizationId, platform, accountId, mediaId, enabled = true } = args;
  return useQuery({
    queryKey: ["meta-content-post-likes", organizationId, platform, accountId, mediaId],
    enabled: Boolean(organizationId && accountId && mediaId && enabled),
    queryFn: async () => {
      const data = await invokeComments({
        action: "listPostLikes",
        organization_id: organizationId,
        platform,
        account_id: accountId,
        media_id: mediaId,
      });
      return data as { likers: MetaPostLiker[]; unavailable: boolean };
    },
    staleTime: 30_000,
  });
}
