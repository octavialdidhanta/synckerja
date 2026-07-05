import { Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useIsMobile } from "@/mobile/shared/hooks/use-mobile";
import { cn } from "@/shared/lib/utils";
import type { WhatsAppAccount, WhatsAppConversation } from "../../../types";
import { useLivechatFlowSendForm } from "../../../hooks/useLivechatFlowSendForm";
import { FlowSendPickerContent } from "./FlowSendPickerContent";

type LivechatFlowSendDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: WhatsAppConversation;
  waAccounts: WhatsAppAccount[];
  showAutoAssignHint?: boolean;
};

function FlowSendDialogTitle({
  isMobile,
  onClose,
  title,
}: {
  isMobile: boolean;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", isMobile && "pr-2")}>
      {isMobile ? (
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onClose} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
      ) : null}
      <DialogTitle className={cn(isMobile ? "text-lg" : "text-base")}>{title}</DialogTitle>
    </div>
  );
}

export function LivechatFlowSendDialog({
  open,
  onOpenChange,
  conversation,
  waAccounts,
  showAutoAssignHint = false,
}: LivechatFlowSendDialogProps) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();

  const form = useLivechatFlowSendForm({
    open,
    conversation,
    waAccounts,
    filterMode: "flow_only",
    t,
    onSent: () => onOpenChange(false),
    successToastKey: "whatsappInbox.flowSend.sent",
    flowSuccessToastKey: "whatsappInbox.flowSend.sent",
  });

  const contactLabel =
    conversation.customer_name?.trim() || conversation.customer_wa_id || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isMobile
            ? "fixed left-0 right-0 top-0 max-h-none w-full max-w-none translate-x-0 translate-y-0 rounded-none modal-above-safe-area"
            : "max-h-[90vh] max-w-3xl w-[95vw]",
        )}
        hideCloseButton={isMobile}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={cn(
            "flex-shrink-0 border-b px-4 text-left",
            isMobile ? "safe-area-top pb-3 pt-4" : "py-3",
          )}
        >
          <FlowSendDialogTitle
            isMobile={isMobile}
            onClose={() => onOpenChange(false)}
            title={t("whatsappInbox.flowSend.title", "Kirim Flow")}
          />
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {t(
              "whatsappInbox.flowSend.description",
              "Pilih Form Flow atau Flow Template untuk dikirim ke kontak ini.",
            )}
            {" · "}
            {contactLabel}
            {form.ticketId ? ` · ${form.ticketId}` : ""}
          </DialogDescription>
        </DialogHeader>

        {showAutoAssignHint ? (
          <div className="mx-4 mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-slate-800">
            {t(
              "whatsappInbox.followUp.autoAssignHint",
              "Saat Anda mengirim follow-up, Anda akan otomatis ditetapkan sebagai agen percakapan ini.",
            )}
          </div>
        ) : null}

        <div
          className={cn(
            "scrollbar-hide seamless-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4",
            isMobile && "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          <FlowSendPickerContent
            mode="flow_only"
            waAccountId={form.waAccountId}
            form={form}
            isMobile={isMobile}
          />
        </div>

        <div
          className={cn(
            "flex flex-shrink-0 items-center gap-2 border-t bg-muted/30 px-4 py-3",
            isMobile ? "justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))]" : "justify-end",
          )}
        >
          {isMobile ? (
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => onOpenChange(false)}>
              {t("common.cancel", "Batal")}
            </Button>
          ) : null}
          <Button
            type="button"
            className={cn(isMobile && "min-w-[120px] flex-1")}
            disabled={
              !form.selectionValue ||
              form.isSending ||
              form.isEmptyCatalog ||
              (!form.isSessionFlow && form.templateDetail.isFetching)
            }
            onClick={() => void form.handleSend()}
          >
            {form.isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {t("whatsappInbox.followUp.sending", "Mengirim…")}
              </>
            ) : (
              t("whatsappInbox.flowSend.button", "Kirim Flow")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
