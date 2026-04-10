import { ExternalLink, Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/features/ui/dialog";
import { Button } from "@/mobile/components/ui/button";
import { useIsMobile } from "@/mobile/hooks/use-mobile";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { useSocialMediaLinks } from "@/features/6-1-dashboard/hook/useSocialMediaLinks";
import { cn } from "@/lib/utils";

interface SocialMediaLinksMobileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  socialMediaPlanId: string | null;
  planTitle?: string | null;
  /** If set, footer "Back" runs this (e.g. close parent + go to mobile home) instead of only closing the dialog. */
  onBack?: () => void;
}

export function SocialMediaLinksMobileModal({
  open,
  onOpenChange,
  socialMediaPlanId,
  planTitle,
  onBack,
}: SocialMediaLinksMobileModalProps) {
  const isMobile = useIsMobile();
  const { t } = useAppTranslation();
  const { links, isLoading } = useSocialMediaLinks(socialMediaPlanId ?? undefined);

  const handleOpenLink = (url: string) => {
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-full max-w-none m-0 rounded-none translate-x-0 translate-y-0 flex flex-col p-0 gap-0 border-none bg-card shadow-xl focus:outline-none overflow-hidden",
          isMobile
            ? "fixed left-0 right-0 top-0 modal-above-safe-area h-screen"
            : "md:max-w-lg md:max-h-[85vh] md:rounded-lg md:translate-x-[-50%] md:translate-y-[-50%] md:left-[50%] md:top-[50%] fixed inset-0 md:h-auto"
        )}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={cn(
            "flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left",
            isMobile ? "safe-area-top px-4 pt-4 pb-3" : "px-4 pt-4 pb-3"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mt-0.5">
              <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold text-foreground">
                {t("mobileHome.socialMediaLinksModal.title", "Social Media Links")}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t(
                  "mobileHome.socialMediaLinksModal.description",
                  "Klik link untuk membuka posting yang sudah dipublikasikan."
                )}
              </p>
              {planTitle && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {t("mobileHome.socialMediaLinksModal.contentPrefix", "Content")}: {planTitle}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-4 pt-4 pb-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              {t("mobileHome.loading", "Loading...")}
            </p>
          ) : links.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 bg-muted/30">
              <p className="text-sm text-muted-foreground">
                {t(
                  "mobileHome.socialMediaLinksModal.empty",
                  "Link social media belum tersedia untuk konten ini."
                )}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.id}>
                  <button
                    type="button"
                    onClick={() => handleOpenLink(link.url)}
                    className="w-full rounded-lg border border-border bg-muted/40 p-3 text-left hover:bg-muted/60 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground break-words">
                      {link.platform} - {link.social_media_name} - {link.url}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>
                        {t("mobileHome.socialMediaLinksModal.openLink", "Open link")}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => (onBack ? onBack() : onOpenChange(false))}
              className="min-w-[120px] flex items-center justify-center gap-1.5"
            >
              {t("mobileHome.socialMediaLinksModal.back", "Kembali")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SocialMediaLinksMobileModal;
