import { useState } from "react";
import { Image, Loader2, Smile } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";

const TIKTOK_REPLY_MAX_LENGTH = 150;

type ManageCommentsComposerProps = {
  accountLabel: string;
  accountAvatarUrl?: string | null;
  placeholder?: string;
  replyToCommentId?: string | null;
  replyToLabel?: string | null;
  onCancelReply?: () => void;
  onSubmit: (text: string) => Promise<void>;
  disabled?: boolean;
  requireReplyTarget?: boolean;
};

export function ManageCommentsComposer({
  accountLabel,
  accountAvatarUrl,
  placeholder,
  replyToCommentId,
  replyToLabel,
  onCancelReply,
  onSubmit,
  disabled,
  requireReplyTarget = false,
}: ManageCommentsComposerProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const needsReplyTarget = requireReplyTarget && !replyToCommentId;
  const canSubmit = Boolean(text.trim()) && !submitting && !disabled && !needsReplyTarget;

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting || disabled || needsReplyTarget) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setText("");
      onCancelReply?.();
    } finally {
      setSubmitting(false);
    }
  };

  const initials = accountLabel.slice(0, 2).toUpperCase();

  return (
    <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">
      {replyToCommentId ? (
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">
            {t("digitalMarketing.manageComments.replyingToUser", {
              name: replyToLabel?.trim() || t("digitalMarketing.manageComments.replyingTo", "comment"),
              defaultValue: "Replying to {{name}}",
            })}
          </span>
          <button
            type="button"
            className="shrink-0 text-primary hover:underline"
            onClick={onCancelReply}
          >
            {t("digitalMarketing.manageComments.cancelReply", "Cancel")}
          </button>
        </div>
      ) : requireReplyTarget ? (
        <p className="mb-2 text-xs text-muted-foreground">
          {t(
            "digitalMarketing.manageComments.clickReplyFirst",
            "Click Reply on a comment to respond.",
          )}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={accountAvatarUrl ?? undefined} alt={accountLabel} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="relative min-w-0 flex-1">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              placeholder ??
              (replyToCommentId
                ? t("digitalMarketing.manageComments.writeReplyPlaceholder", {
                    defaultValue: "Write a reply…",
                  })
                : t("digitalMarketing.manageComments.replyPlaceholder", {
                    name: accountLabel,
                    defaultValue: `Comment as ${accountLabel}`,
                  }))
            }
            rows={2}
            maxLength={TIKTOK_REPLY_MAX_LENGTH}
            disabled={disabled || submitting || needsReplyTarget}
            className="min-h-[44px] resize-none rounded-2xl bg-gray-50 pr-24 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-1 text-muted-foreground">
            <Smile className="h-4 w-4 opacity-50" aria-hidden />
            <Image className="h-4 w-4 opacity-50" aria-hidden />
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t("digitalMarketing.manageComments.post", "Post")
          )}
        </Button>
      </div>
    </div>
  );
}

ManageCommentsComposer.displayName = "ManageCommentsComposer";
