import { useEffect, useState } from "react";
import {
  Briefcase,
  Bot,
  Clock,
  MessageCircleX,
  Megaphone,
  Search,
  Timer,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { FlowTemplateCard } from "@/5-3-automation-flow/components/editor/wizard/FlowTemplateCard";
import { automationFlowEditorPath } from "@/5-3-automation-flow/constants/automationFlowPaths";
import type { FlowTemplateId } from "@/5-3-automation-flow/lib/graph/flowTemplateGraphs";
import { useCreateAutomationFlow } from "@/5-3-dashboard/omnichannel-settings/hooks/flow-builder/useAutomationFlowListing";

type CreateAutomationFlowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

const TEMPLATE_CARDS: Array<{
  id: FlowTemplateId;
  titleKey: string;
  descriptionKey: string;
  icon: typeof Megaphone;
  gradientClass: string;
  enabled: boolean;
}> = [
  {
    id: "out_of_business_hour",
    titleKey: "omnichannel.automationFlow.create.template.outOfBusinessHour.title",
    descriptionKey: "omnichannel.automationFlow.create.template.outOfBusinessHour.description",
    icon: Briefcase,
    gradientClass: "bg-gradient-to-br from-sky-500 to-blue-700",
    enabled: false,
  },
  {
    id: "welcome_message",
    titleKey: "omnichannel.automationFlow.create.template.welcomeMessage.title",
    descriptionKey: "omnichannel.automationFlow.create.template.welcomeMessage.description",
    icon: Megaphone,
    gradientClass: "bg-gradient-to-br from-pink-500 to-rose-600",
    enabled: true,
  },
  {
    id: "keyword",
    titleKey: "omnichannel.automationFlow.create.template.keyword.title",
    descriptionKey: "omnichannel.automationFlow.create.template.keyword.description",
    icon: Search,
    gradientClass: "bg-gradient-to-br from-emerald-500 to-green-700",
    enabled: false,
  },
  {
    id: "chatbot",
    titleKey: "omnichannel.automationFlow.create.template.chatbot.title",
    descriptionKey: "omnichannel.automationFlow.create.template.chatbot.description",
    icon: Bot,
    gradientClass: "bg-gradient-to-br from-amber-400 to-orange-600",
    enabled: false,
  },
  {
    id: "idle_customer",
    titleKey: "omnichannel.automationFlow.create.template.idleCustomer.title",
    descriptionKey: "omnichannel.automationFlow.create.template.idleCustomer.description",
    icon: Timer,
    gradientClass: "bg-gradient-to-br from-violet-500 to-purple-700",
    enabled: false,
  },
  {
    id: "invalid_reply",
    titleKey: "omnichannel.automationFlow.create.template.invalidReply.title",
    descriptionKey: "omnichannel.automationFlow.create.template.invalidReply.description",
    icon: MessageCircleX,
    gradientClass: "bg-gradient-to-br from-slate-400 to-gray-600",
    enabled: false,
  },
];

export function FlowBuilderCreateAutomationFlowDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateAutomationFlowDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createFlow = useCreateAutomationFlow();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!open) setDisplayName("");
  }, [open]);

  const handleCreate = async (template: FlowTemplateId) => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast.error(t("omnichannel.settings.flowBuilder.listing.createNameRequired"));
      return;
    }

    try {
      const flow = await createFlow.mutateAsync({ name: trimmed, template });
      onOpenChange(false);
      onCreated?.();
      navigate(automationFlowEditorPath(flow.id));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("omnichannel.settings.flowBuilder.listing.createFailed"),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader className="space-y-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div className="space-y-1 pr-8">
            <DialogTitle className="text-xl">{t("omnichannel.automationFlow.create.title")}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t("omnichannel.automationFlow.create.subtitle")}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <div className="w-full space-y-1.5 sm:w-56">
              <Label htmlFor="automation-flow-name" className="sr-only">
                {t("omnichannel.settings.flowBuilder.listing.createNameLabel")}
              </Label>
              <Input
                id="automation-flow-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t("omnichannel.automationFlow.create.namePlaceholder")}
              />
            </div>
            <Button
              type="button"
              onClick={() => void handleCreate("scratch")}
              disabled={createFlow.isPending}
            >
              {createFlow.isPending
                ? t("omnichannel.settings.flowBuilder.listing.createSubmitting")
                : t("omnichannel.automationFlow.create.startFromScratch")}
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATE_CARDS.map((card) => (
            <FlowTemplateCard
              key={card.id}
              titleKey={card.titleKey}
              descriptionKey={card.descriptionKey}
              icon={card.icon}
              gradientClass={card.gradientClass}
              disabled={!card.enabled || createFlow.isPending}
              onClick={() => void handleCreate(card.id)}
            />
          ))}
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {t("omnichannel.automationFlow.create.templateHint")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
