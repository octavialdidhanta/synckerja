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
};

function FlowSendMobileHeader({
  onClose,
  title,
  contactLine,
}: {
  onClose: () => void;
  title: string;
  contactLine: string;
}) {
  return (
    <header className="safe-area-top flex shrink-0 items-center gap-1 border-b px-2 py-2.5">
      <DialogTitle className="sr-only">
        {title} · {contactLine}
      </DialogTitle>
      <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onClose} aria-label="Close">
        <X className="h-5 w-5" />
      </Button>
      <div className="flex min-h-10 min-w-0 flex-1 items-center gap-1.5 overflow-hidden pr-2">
        <span className="shrink-0 text-lg font-semibold leading-[1.25rem]">{title}</span>
        <span className="shrink-0 leading-[1.25rem] text-muted-foreground" aria-hidden>
          ·
        </span>
        <span className="min-w-0 truncate text-lg font-medium leading-[1.25rem] text-muted-foreground">{contactLine}</span>
      </div>
    </header>
  );
}

function FlowSendDesktopHeader({
  title,
  contactLine,
}: {
  title: string;
  contactLine: string;
}) {
  return (
    <DialogHeader className="flex-shrink-0 space-y-0 border-b px-4 py-3 text-left">
      <div className="flex min-w-0 items-center gap-2 pr-8">
        <DialogTitle className="my-0 shrink-0 text-base leading-none">{title}</DialogTitle>
        <span className="shrink-0 text-muted-foreground" aria-hidden>
          ·
        </span>
        <DialogDescription className="my-0 min-w-0 truncate text-sm font-medium leading-none text-muted-foreground">
          {contactLine}
        </DialogDescription>
      </div>
    </DialogHeader>
  );
}

export function LivechatFlowSendDialog({
  open,
  onOpenChange,
  conversation,
  waAccounts,
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
  const mobileContactLine = form.ticketId ? `${contactLabel} · ${form.ticketId}` : contactLabel;

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
        {isMobile ? (
          <FlowSendMobileHeader
            onClose={() => onOpenChange(false)}
            title={t("whatsappInbox.flowSend.title", "Kirim Flow")}
            contactLine={mobileContactLine}
          />
        ) : (
          <FlowSendDesktopHeader
            title={t("whatsappInbox.flowSend.title", "Kirim Flow")}
            contactLine={mobileContactLine}
          />
        )}

        <div
          className={cn(
            "scrollbar-hide seamless-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4",
            isMobile ? "py-3" : "py-4",
            isMobile && "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          <FlowSendPickerContent
            mode="flow_only"
            waAccountId={form.waAccountId}
            form={form}
            isMobile={isMobile}
            minimalChrome
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
