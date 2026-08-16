import { useEffect, useRef, useState } from "react";
import { Image, Loader2, Smile } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { cn } from "@/shared/lib/utils";
import { useManageCommentsMobileLayout } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsMobileLayoutContext";

const TIKTOK_REPLY_MAX_LENGTH = 150;

type ManageCommentsInlineReplyComposerProps = {
  accountLabel: string;
  accountAvatarUrl?: string | null;
  mentionLabel?: string | null;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  isSubmitting?: boolean;
  className?: string;
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
};

export function ManageCommentsInlineReplyComposer({
  accountLabel,
  accountAvatarUrl,
  mentionLabel,
  placeholder,
  maxLength = TIKTOK_REPLY_MAX_LENGTH,
  autoFocus = true,
  disabled,
  isSubmitting,
  className,
  onSubmit,
  onCancel,
}: ManageCommentsInlineReplyComposerProps) {
  const { t } = useTranslation();
  const isMobileLayout = useManageCommentsMobileLayout();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initials = accountLabel.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!autoFocus) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const keepVisible = () => {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    const frame = window.requestAnimationFrame(keepVisible);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", keepVisible);
    return () => {
      window.cancelAnimationFrame(frame);
      vv?.removeEventListener("resize", keepVisible);
    };
  }, [autoFocus]);

  const canSubmit = Boolean(text.trim()) && !isSubmitting && !disabled;

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSubmitting || disabled) return;
    await onSubmit(trimmed);
    setText("");
  };

  return (
    <div
      data-reply-composer=""
      className={cn("mt-2 flex gap-2", isMobileLayout && "mt-3 flex-col gap-2", className)}
    >
      {isMobileLayout ? null : (
        <Avatar className="mt-0.5 h-7 w-7 shrink-0">
          <AvatarImage src={accountAvatarUrl ?? undefined} alt={accountLabel} />
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0 flex-1">
        {mentionLabel ? (
          <p className="mb-1 text-[11px] text-muted-foreground">
            {t("digitalMarketing.manageComments.replyingToUser", {
              name: mentionLabel,
              defaultValue: "Replying to {{name}}",
            })}
            {onCancel ? (
              <>
                {" · "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={onCancel}
                >
                  {t("digitalMarketing.manageComments.cancelReply", "Cancel")}
                </button>
              </>
            ) : null}
          </p>
        ) : null}
        <div className={cn("flex gap-2", !isMobileLayout && "items-end")}>
          <div className="relative min-w-0 flex-1">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                placeholder ??
                t("digitalMarketing.manageComments.inlineReplyPlaceholder", {
                  name: accountLabel,
                  defaultValue: `Reply as ${accountLabel}`,
                })
              }
              rows={isMobileLayout ? 3 : 1}
              maxLength={maxLength}
              disabled={disabled || isSubmitting}
              className={cn(
                "resize-none rounded-2xl bg-gray-100 text-sm",
                isMobileLayout
                  ? "min-h-[88px] py-2.5 pl-3 pr-16 pb-9"
                  : "min-h-[36px] py-2 pl-3 pr-16",
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
            />
            {isMobileLayout ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="absolute bottom-1.5 right-1.5 h-7 px-2.5 text-xs font-medium text-primary hover:bg-transparent hover:text-primary"
                disabled={!canSubmit}
                onClick={() => void handleSubmit()}
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  t("digitalMarketing.manageComments.post", "Post")
                )}
              </Button>
            ) : (
              <div className="absolute bottom-1.5 right-2 flex items-center gap-1 text-muted-foreground">
                <Smile className="h-3.5 w-3.5 opacity-50" aria-hidden />
                <Image className="h-3.5 w-3.5 opacity-50" aria-hidden />
              </div>
            )}
          </div>
          {isMobileLayout ? null : (
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 px-3"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                t("digitalMarketing.manageComments.post", "Post")
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

ManageCommentsInlineReplyComposer.displayName = "ManageCommentsInlineReplyComposer";
