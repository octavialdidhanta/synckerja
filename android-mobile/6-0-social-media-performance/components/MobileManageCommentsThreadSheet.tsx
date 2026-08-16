import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { MobileManageCommentsPostPreview } from "@/mobile/6-0-social-media-performance/components/MobileManageCommentsPostPreview";
import { ManageCommentsMobileLayoutProvider } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsMobileLayoutContext";
import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

type InboxPlatform = "tiktok" | "youtube" | "instagram" | "facebook" | "linkedin" | "threads";

function parseThreadPlatform(pathname: string): InboxPlatform {
  if (pathname.includes("/manage-comments/youtube")) return "youtube";
  if (pathname.includes("/manage-comments/instagram")) return "instagram";
  if (pathname.includes("/manage-comments/facebook")) return "facebook";
  if (pathname.includes("/manage-comments/linkedin")) return "linkedin";
  if (pathname.includes("/manage-comments/threads")) return "threads";
  return "tiktok";
}

type MobileManageCommentsThreadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: ManageCommentsPostListItem;
  likesContext?: {
    organizationId: string;
    accountId: string;
  };
  children: ReactNode;
};

export function MobileManageCommentsThreadSheet({
  open,
  onOpenChange,
  post,
  likesContext,
  children,
}: MobileManageCommentsThreadSheetProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const platform = parseThreadPlatform(location.pathname);
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed z-[80] flex min-h-0 w-full flex-col bg-background"
      style={mainFixedStyle}
      role="dialog"
      aria-modal="true"
      aria-label={t("digitalMarketing.manageComments.commentsTitle", "Comments")}
    >
      <header className="safe-area-top flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={t("common.back", "Back")}
          onClick={() => onOpenChange(false)}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
          {t("digitalMarketing.manageComments.commentsTitle", "Comments")}
        </h2>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="scrollbar-hide nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isKeyboardShellOpen ? null : (
            <div className="px-3 pb-2 pt-2">
              <MobileManageCommentsPostPreview
                post={post}
                platform={platform}
                likesContext={likesContext}
              />
            </div>
          )}
          <div className="[&_aside]:hidden [&_.overflow-hidden]:overflow-visible [&_.overflow-y-auto]:overflow-visible">
            <ManageCommentsMobileLayoutProvider>{children}</ManageCommentsMobileLayoutProvider>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

MobileManageCommentsThreadSheet.displayName = "MobileManageCommentsThreadSheet";
