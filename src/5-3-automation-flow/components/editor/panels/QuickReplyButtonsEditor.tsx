import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { QUICK_REPLY_LIMITS } from "@/5-3-automation-flow/lib/graph/sendMessageData";
import type { ListMessageOption } from "@/5-3-automation-flow/types/automationFlowGraph.types";

type QuickReplyButtonsEditorProps = {
  options: ListMessageOption[];
  onChange: (patch: { listOptions?: ListMessageOption[] }) => void;
};

function newOptionId(): string {
  return `opt-${crypto.randomUUID().slice(0, 8)}`;
}

export function QuickReplyButtonsEditor({ options, onChange }: QuickReplyButtonsEditorProps) {
  const { t } = useTranslation();

  const updateOption = (index: number, patch: Partial<ListMessageOption>) => {
    const next = options.map((opt, i) => (i === index ? { ...opt, ...patch } : opt));
    onChange({ listOptions: next });
  };

  const removeOption = (index: number) => {
    onChange({ listOptions: options.filter((_, i) => i !== index) });
  };

  const addOption = () => {
    if (options.length >= QUICK_REPLY_LIMITS.maxButtons) return;
    onChange({
      listOptions: [...options, { id: newOptionId(), title: "" }],
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
      <div className="space-y-3">
        <Label>{t("omnichannel.automationFlow.editor.quickReplyButtons")}</Label>
        {options.map((option, index) => (
          <div key={option.id} className="flex items-center gap-2">
            <Input
              value={option.title}
              maxLength={QUICK_REPLY_LIMITS.titleMax}
              placeholder={t("omnichannel.automationFlow.editor.quickReplyButtonPlaceholder")}
              className="rounded-full"
              onChange={(e) =>
                updateOption(index, { title: e.target.value.slice(0, QUICK_REPLY_LIMITS.titleMax) })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => removeOption(index)}
              aria-label={t("omnichannel.automationFlow.editor.removeOption")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {options.length < QUICK_REPLY_LIMITS.maxButtons ? (
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed"
            onClick={addOption}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("omnichannel.automationFlow.editor.addButton")}
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {t("omnichannel.automationFlow.editor.quickReplyLimitHint", {
            max: QUICK_REPLY_LIMITS.maxButtons,
            chars: QUICK_REPLY_LIMITS.titleMax,
          })}
        </p>
      </div>
    </div>
  );
}
