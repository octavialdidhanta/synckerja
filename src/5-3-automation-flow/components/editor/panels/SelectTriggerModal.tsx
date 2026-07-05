import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

type SelectTriggerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: () => void;
};

const DISABLED_TRIGGERS = [
  "omnichannel.automationFlow.editor.trigger.messagesFromNewContact",
  "omnichannel.automationFlow.editor.trigger.outgoingMessages",
  "omnichannel.automationFlow.editor.trigger.conversationStatus",
  "omnichannel.automationFlow.editor.trigger.newContacts",
  "omnichannel.automationFlow.editor.trigger.contactFieldUpdate",
  "omnichannel.automationFlow.editor.trigger.labelAdded",
] as const;

export function SelectTriggerModal({ open, onOpenChange, onSelect }: SelectTriggerModalProps) {
  const { t } = useTranslation();

  const handleSelectIncoming = () => {
    onSelect();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("omnichannel.automationFlow.editor.selectTrigger.title")}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {t("omnichannel.automationFlow.editor.selectTrigger.subtitle")}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("omnichannel.automationFlow.editor.selectTrigger.interactionSection")}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <button
                type="button"
                onClick={handleSelectIncoming}
                className="rounded-lg border border-border bg-card p-4 text-left transition hover:border-primary hover:bg-accent/50"
              >
                <div className="mb-2 font-semibold text-foreground">
                  {t("omnichannel.automationFlow.editor.trigger.incomingMessages")}
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t("omnichannel.automationFlow.editor.trigger.incomingMessagesHint")}
                </p>
                <Badge variant="outline" className="text-[10px] uppercase">
                  WhatsApp
                </Badge>
              </button>

              {DISABLED_TRIGGERS.slice(0, 3).map((key) => (
                <div
                  key={key}
                  className={cn(
                    "cursor-not-allowed rounded-lg border border-border bg-card p-4 opacity-50",
                  )}
                >
                  <div className="mb-2 font-semibold text-foreground">{t(key)}</div>
                  <p className="mb-3 text-xs text-muted-foreground">{t(`${key}Hint`)}</p>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    WhatsApp
                  </Badge>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("omnichannel.automationFlow.editor.selectTrigger.contactSection")}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DISABLED_TRIGGERS.slice(3).map((key) => (
                <div
                  key={key}
                  className="cursor-not-allowed rounded-lg border border-border bg-card p-4 opacity-50"
                >
                  <div className="mb-2 font-semibold text-foreground">{t(key)}</div>
                  <p className="text-xs text-muted-foreground">{t(`${key}Hint`)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
