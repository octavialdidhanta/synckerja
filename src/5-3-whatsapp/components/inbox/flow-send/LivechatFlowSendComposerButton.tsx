import { Workflow } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

type LivechatFlowSendComposerButtonProps = {
  disabled?: boolean;
  onClick: () => void;
  compact?: boolean;
};

export function LivechatFlowSendComposerButton({
  disabled,
  onClick,
  compact,
}: LivechatFlowSendComposerButtonProps) {
  const { t } = useAppTranslation();

  return (
    <button
      type="button"
      className={cn(
        "flex shrink-0 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50",
        compact ? "h-9 w-9" : "h-9 w-9",
      )}
      disabled={disabled}
      onClick={onClick}
      title={t("whatsappInbox.flowSend.button", "Kirim Flow")}
      aria-label={t("whatsappInbox.flowSend.buttonAria", "Kirim Form Flow atau Flow Template")}
    >
      <Workflow className="h-4 w-4" aria-hidden />
    </button>
  );
}
