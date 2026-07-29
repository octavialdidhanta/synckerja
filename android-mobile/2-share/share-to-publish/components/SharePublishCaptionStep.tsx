import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/mobile-app/components/ui/textarea";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  appendHashtagToCaption,
  filterHashtagSuggestions,
  getActiveHashtagQuery,
  suggestHashtagsFromPlan,
} from "../lib/captionHashtagSuggest";
import {
  filterMentionHandles,
  readMentionRecents,
  rememberMentionHandle,
} from "../lib/captionMentionRecents";
import {
  getActiveMentionQuery,
  insertMentionHandle,
} from "../lib/captionMentionUtils";
import {
  resolveAndSaveCaptionMention,
  useShareCaptionHashtagSuggest,
  useShareCaptionMentionSuggest,
} from "../hooks/useShareCaptionSuggest";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  planTitle?: string | null;
  contentPillarName?: string | null;
  organizationId?: string | null;
};

export function SharePublishCaptionStep({
  value,
  onChange,
  disabled,
  planTitle,
  contentPillarName,
  organizationId,
}: Props) {
  const { t } = useAppTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    setRecents(readMentionRecents(organizationId));
  }, [organizationId]);

  const activeMention = getActiveMentionQuery(value, caret);
  const activeHashtag = !activeMention ? getActiveHashtagQuery(value, caret) : null;

  const mentionApi = useShareCaptionMentionSuggest({
    organizationId,
    query: activeMention ? activeMention.query : null,
    enabled: Boolean(activeMention),
  });

  const hashtagApi = useShareCaptionHashtagSuggest({
    organizationId,
    query: activeHashtag?.query ?? "",
    title: planTitle,
    pillar: contentPillarName,
    enabled: true,
  });

  const localHashtags = useMemo(
    () =>
      suggestHashtagsFromPlan({
        title: planTitle,
        contentPillarName,
      }),
    [planTitle, contentPillarName],
  );

  const apiHashtagTags = (hashtagApi.data ?? []).map((h) => h.tag);
  const hashtagSuggestions =
    apiHashtagTags.length > 0 ? apiHashtagTags : localHashtags;

  const apiMentions = mentionApi.data ?? [];
  const recentFiltered = activeMention
    ? filterMentionHandles(recents, activeMention.query)
    : [];

  const mentionCandidates = useMemo(() => {
    if (!activeMention) return [] as Array<{
      handle: string;
      displayName?: string | null;
      source: string;
    }>;
    const seen = new Set<string>();
    const out: Array<{ handle: string; displayName?: string | null; source: string }> = [];
    for (const item of apiMentions) {
      const key = item.handle.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        handle: item.handle,
        displayName: item.displayName,
        source: item.source,
      });
    }
    for (const handle of recentFiltered) {
      const key = handle.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ handle, source: "recent" });
    }
    return out.slice(0, 12);
  }, [activeMention, apiMentions, recentFiltered]);

  const hashtagFilterList = activeHashtag
    ? filterHashtagSuggestions(hashtagSuggestions, activeHashtag.query)
    : [];

  const syncCaret = (el: HTMLTextAreaElement) => {
    setCaret(el.selectionStart ?? el.value.length);
  };

  const applyText = (nextText: string, nextCaret: number) => {
    onChange(nextText);
    setCaret(nextCaret);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const maybeRememberTypedMention = (text: string, nextCaret: number) => {
    if (!organizationId) return;
    const before = text.slice(0, nextCaret);
    const match = /(?:^|[\s])@([a-zA-Z0-9._]{2,})(?:\s|[.,!?)]|$)/.exec(
      before.slice(Math.max(0, before.length - 48)),
    );
    if (!match?.[1]) return;
    setRecents(rememberMentionHandle(organizationId, match[1]));
  };

  const pickMention = (handle: string, source?: string) => {
    const { nextText, nextCaret } = insertMentionHandle(value, caret, handle);
    const nextRecents = rememberMentionHandle(organizationId, handle);
    setRecents(nextRecents);
    applyText(nextText, nextCaret);
    if (organizationId && (source === "meta" || source === "curated")) {
      void resolveAndSaveCaptionMention({
        organizationId,
        handle,
        save: true,
      }).catch(() => undefined);
    }
  };

  const pickHashtag = (tag: string) => {
    if (activeHashtag) {
      const before = value.slice(0, activeHashtag.start);
      const after = value.slice(caret);
      const insert = `${tag} `;
      applyText(before + insert + after, before.length + insert.length);
      return;
    }
    onChange(appendHashtagToCaption(value, tag));
  };

  const showMentionMenu = Boolean(activeMention);
  const showHashtagMenu = Boolean(activeHashtag) && hashtagFilterList.length > 0;

  return (
    <div className="rounded-xl border border-border/70 bg-white p-2.5">
      <p className="text-xs font-medium text-muted-foreground">
        {t("share.publish.caption.label", "Caption")}
      </p>

      {hashtagSuggestions.length > 0 ? (
        <div className="mt-2 space-y-1">
          <p className="text-[11px] text-muted-foreground">
            {t("share.publish.caption.hashtagSuggest", "Suggested hashtags")}
            {hashtagApi.isFetching
              ? ` · ${t("share.publish.caption.suggestLoading", "Loading…")}`
              : null}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {hashtagSuggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                disabled={disabled}
                className={cn(
                  "rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground",
                  "hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50",
                )}
                onClick={() => pickHashtag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="relative mt-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            syncCaret(e.target);
            maybeRememberTypedMention(
              e.target.value,
              e.target.selectionStart ?? e.target.value.length,
            );
          }}
          onClick={(e) => syncCaret(e.target as HTMLTextAreaElement)}
          onKeyUp={(e) => syncCaret(e.target as HTMLTextAreaElement)}
          onSelect={(e) => syncCaret(e.target as HTMLTextAreaElement)}
          disabled={disabled}
          rows={5}
          className="resize-none"
          placeholder={t(
            "share.publish.caption.placeholder",
            "Write caption… Use # for hashtags and @ for handles",
          )}
        />

        {showMentionMenu ? (
          <div className="absolute bottom-full left-0 z-30 mb-1 max-h-40 w-full overflow-y-auto rounded-md border border-border bg-white shadow-md">
            {mentionApi.isFetching && mentionCandidates.length === 0 ? (
              <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                {t("share.publish.caption.suggestLoading", "Loading…")}
              </p>
            ) : mentionCandidates.length > 0 ? (
              mentionCandidates.map((item) => (
                <button
                  key={`${item.source}-${item.handle}`}
                  type="button"
                  className="flex w-full flex-col px-2 py-1.5 text-left text-xs hover:bg-muted/60"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickMention(item.handle, item.source);
                  }}
                >
                  <span>@{item.handle}</span>
                  {item.displayName ? (
                    <span className="text-[10px] text-muted-foreground">
                      {item.displayName}
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                {t(
                  "share.publish.caption.mentionEmpty",
                  "Type a handle (e.g. @prabowo). Recent handles will appear here.",
                )}
              </p>
            )}
            {mentionApi.isError ? (
              <p className="border-t border-border/60 px-2 py-1.5 text-[10px] text-amber-700">
                {t(
                  "share.publish.caption.suggestError",
                  "Could not load suggestions. You can still type @handles freely.",
                )}
              </p>
            ) : null}
          </div>
        ) : null}

        {showHashtagMenu ? (
          <div className="absolute bottom-full left-0 z-30 mb-1 max-h-40 w-full overflow-y-auto rounded-md border border-border bg-white shadow-md">
            {hashtagFilterList.map((tag) => (
              <button
                key={tag}
                type="button"
                className="flex w-full px-2 py-1.5 text-left text-xs hover:bg-muted/60"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickHashtag(tag);
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        {t(
          "share.publish.caption.platformTip",
          "Instagram & TikTok usually parse @handles and #hashtags in caption text. YouTube/LinkedIn mentions are limited — prefer hashtags there. Facebook Reels tagging is weak in plain caption.",
        )}
      </p>
    </div>
  );
}
