import { useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import type { MetaContentPlatform } from "@/meta-platform/types/metaContentTypes";

export function useMetaContentAvatarObjectUrl(args: {
  organizationId: string | null | undefined;
  platform: MetaContentPlatform;
  accountId: string;
  enabled?: boolean;
}): string | null {
  const { organizationId, platform, accountId, enabled = true } = args;
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !organizationId || !accountId) {
      setObjectUrl(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
        if (!token || !supabaseUrl || !anonKey) return;

        const params = new URLSearchParams({
          organization_id: organizationId,
          platform,
          account_id: accountId,
        });

        const res = await fetch(`${supabaseUrl}/functions/v1/meta-content-avatar?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: anonKey,
          },
        });
        if (!res.ok || cancelled) return;

        const blob = await res.blob();
        if (cancelled) return;

        const nextUrl = URL.createObjectURL(blob);
        setObjectUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextUrl;
        });
      } catch {
        if (!cancelled) setObjectUrl(null);
      }
    })();

    return () => {
      cancelled = true;
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [enabled, organizationId, platform, accountId]);

  return objectUrl;
}
