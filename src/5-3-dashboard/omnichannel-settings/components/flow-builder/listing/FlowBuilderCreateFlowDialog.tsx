import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useCreateWhatsAppFlow } from "@/5-3-whatsapp-template/hooks/useCreateWhatsAppFlow";
import {
  buildCustomFormFlowJson,
  toFlowApiName,
} from "@/5-3-whatsapp-template/utils/buildCustomFormFlowJson";

const FLOW_CATEGORIES = [
  "LEAD_GENERATION",
  "CUSTOMER_SUPPORT",
  "SURVEY",
  "OTHER",
] as const;

type FlowBuilderCreateFlowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

export function FlowBuilderCreateFlowDialog({
  open,
  onOpenChange,
  onCreated,
}: FlowBuilderCreateFlowDialogProps) {
  const { t } = useTranslation();
  const createFlow = useCreateWhatsAppFlow();
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState<(typeof FLOW_CATEGORIES)[number]>("LEAD_GENERATION");

  useEffect(() => {
    if (!open) {
      setDisplayName("");
      setCategory("LEAD_GENERATION");
    }
  }, [open]);

  const handleCreate = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast.error(t("omnichannel.settings.flowBuilder.listing.createNameRequired"));
      return;
    }

    const apiName = toFlowApiName(trimmed).replace(/^_|_$/g, "") || "new_flow";
    try {
      await createFlow.mutateAsync({
        name: apiName,
        categories: [category],
        flow_json: buildCustomFormFlowJson({
          screenTitle: trimmed,
          introText: t("omnichannel.settings.flowBuilder.listing.createDefaultIntro"),
          fields: [
            {
              name: "message",
              label: t("omnichannel.settings.flowBuilder.listing.createDefaultFieldLabel"),
              inputType: "text",
              required: true,
            },
          ],
        }),
        publish: false,
      });
      onOpenChange(false);
      onCreated?.();
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("omnichannel.settings.flowBuilder.listing.createFlow")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="flow-display-name">{t("omnichannel.settings.flowBuilder.listing.createNameLabel")}</Label>
            <Input
              id="flow-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={t("omnichannel.settings.flowBuilder.listing.createNamePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("omnichannel.settings.flowBuilder.listing.createCategoryLabel")}</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as (typeof FLOW_CATEGORIES)[number])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLOW_CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {t(`omnichannel.settings.flowBuilder.listing.categories.${item}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("omnichannel.settings.flowBuilder.listing.createCancel")}
          </Button>
          <Button type="button" onClick={() => void handleCreate()} disabled={createFlow.isPending}>
            {createFlow.isPending
              ? t("omnichannel.settings.flowBuilder.listing.createSubmitting")
              : t("omnichannel.settings.flowBuilder.listing.createSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
