import { Paperclip, Plus, Workflow } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/mobile/shared/hooks/use-mobile";
import { LivechatFlowSendComposerButton } from "./LivechatFlowSendComposerButton";

type LivechatComposerAttachMenuProps = {
  /** Force compact single-button menu (e.g. native shell). Also auto-enabled on mobile viewport. */
  compactMenu?: boolean;
  attachDisabled?: boolean;
  onAttach: () => void;
  showFlowSend?: boolean;
  flowSendDisabled?: boolean;
  onFlowSend: () => void;
  isSending?: boolean;
  isUploading?: boolean;
};

export function LivechatComposerAttachMenu({
  compactMenu,
  attachDisabled,
  onAttach,
  showFlowSend,
  flowSendDisabled,
  onFlowSend,
  isSending,
  isUploading,
}: LivechatComposerAttachMenuProps) {
  const { t } = useAppTranslation();
  const isMobileViewport = useIsMobile();
  /** Mobile viewport, native shell, or any WA chat with flow send → single + menu. */
  const useCompactMenu = compactMenu || isMobileViewport || Boolean(showFlowSend);
  const attachBlocked = Boolean(attachDisabled || isSending || isUploading);

  if (useCompactMenu) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
            disabled={attachBlocked && (!showFlowSend || flowSendDisabled)}
            title={t("whatsappInbox.composerActions.menu", "Opsi pesan")}
            aria-label={t("whatsappInbox.composerActions.menu", "Opsi pesan")}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="min-w-[11rem]">
          <DropdownMenuItem
            disabled={attachBlocked}
            onSelect={() => {
              if (attachBlocked) return;
              onAttach();
            }}
            className="gap-2"
          >
            <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
            {t("whatsappInbox.attachMedia", "Attach image, video, or document")}
          </DropdownMenuItem>
          {showFlowSend ? (
            <DropdownMenuItem
              disabled={flowSendDisabled}
              onSelect={() => {
                if (flowSendDisabled) return;
                onFlowSend();
              }}
              className="gap-2"
            >
              <Workflow className="h-4 w-4 shrink-0" aria-hidden />
              {t("whatsappInbox.flowSend.button", "Kirim Flow")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50",
        )}
        disabled={attachBlocked}
        onClick={() => !attachBlocked && onAttach()}
        title={t("whatsappInbox.attachMedia", "Attach image, video, or document")}
        aria-label={t("whatsappInbox.attachMedia", "Attach image, video, or document")}
      >
        <Paperclip className="h-4 w-4" />
      </button>
      {showFlowSend ? (
        <LivechatFlowSendComposerButton disabled={flowSendDisabled} onClick={onFlowSend} />
      ) : null}
    </>
  );
}
