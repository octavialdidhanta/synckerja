import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export type CaptionMentionSuggestItem = {
  handle: string;
  displayName: string | null;
  source: "curated" | "history" | "meta";
  profilePictureUrl?: string | null;
};

export type CaptionHashtagSuggestItem = {
  tag: string;
  source: "curated" | "history" | "plan";
};

async function invokeCaptionSuggest<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("share-caption-suggest", {
    body,
  });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function useShareCaptionMentionSuggest(args: {
  organizationId: string | null | undefined;
  query: string | null;
  enabled?: boolean;
}) {
  const debouncedQ = useDebouncedValue(args.query ?? "", 280);
  const enabled =
    Boolean(args.organizationId) &&
    args.enabled !== false &&
    args.query !== null;

  return useQuery({
    queryKey: ["shareCaptionSuggest", "mentions", args.organizationId, debouncedQ],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const data = await invokeCaptionSuggest<{ mentions?: CaptionMentionSuggestItem[] }>({
        action: "mentions",
        organization_id: args.organizationId,
        q: debouncedQ,
      });
      return data.mentions ?? [];
    },
  });
}

export function useShareCaptionHashtagSuggest(args: {
  organizationId: string | null | undefined;
  query?: string;
  title?: string | null;
  pillar?: string | null;
  enabled?: boolean;
}) {
  const debouncedQ = useDebouncedValue(args.query ?? "", 280);
  const enabled = Boolean(args.organizationId) && args.enabled !== false;

  return useQuery({
    queryKey: [
      "shareCaptionSuggest",
      "hashtags",
      args.organizationId,
      debouncedQ,
      args.title ?? "",
      args.pillar ?? "",
    ],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const data = await invokeCaptionSuggest<{ hashtags?: CaptionHashtagSuggestItem[] }>({
        action: "hashtags",
        organization_id: args.organizationId,
        q: debouncedQ,
        title: args.title ?? "",
        pillar: args.pillar ?? "",
      });
      return data.hashtags ?? [];
    },
  });
}

export async function resolveAndSaveCaptionMention(args: {
  organizationId: string;
  handle: string;
  save?: boolean;
}): Promise<CaptionMentionSuggestItem | null> {
  const data = await invokeCaptionSuggest<{ mention?: CaptionMentionSuggestItem | null }>({
    action: "resolve_mention",
    organization_id: args.organizationId,
    handle: args.handle,
    save: args.save !== false,
  });
  return data.mention ?? null;
}
