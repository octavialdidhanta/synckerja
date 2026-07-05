import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { LIST_MESSAGE_LIMITS } from "@/5-3-automation-flow/lib/graph/sendMessageData";
import type { ListMessageOption } from "@/5-3-automation-flow/types/automationFlowGraph.types";

type ListMessageOptionsEditorProps = {
  listButtonText: string;
  options: ListMessageOption[];
  onChange: (patch: {
    listButtonText?: string;
    listOptions?: ListMessageOption[];
  }) => void;
};

function newOptionId(): string {
  return `opt-${crypto.randomUUID().slice(0, 8)}`;
}

export function ListMessageOptionsEditor({
  listButtonText,
  options,
  onChange,
}: ListMessageOptionsEditorProps) {
  const { t } = useTranslation();

  const updateOption = (index: number, patch: Partial<ListMessageOption>) => {
    const next = options.map((opt, i) => (i === index ? { ...opt, ...patch } : opt));
    onChange({ listOptions: next });
  };

  const removeOption = (index: number) => {
    onChange({ listOptions: options.filter((_, i) => i !== index) });
  };

  const addOption = () => {
    if (options.length >= LIST_MESSAGE_LIMITS.maxOptions) return;
    onChange({
      listOptions: [
        ...options,
        { id: newOptionId(), title: "", description: "" },
      ],
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
      <div className="space-y-2">
        <Label htmlFor="list-button-text">{t("omnichannel.automationFlow.editor.listButtonText")}</Label>
        <Input
          id="list-button-text"
          value={listButtonText}
          maxLength={LIST_MESSAGE_LIMITS.listButtonTextMax}
          placeholder={t("omnichannel.automationFlow.editor.listButtonTextPlaceholder")}
          onChange={(e) => onChange({ listButtonText: e.target.value.slice(0, LIST_MESSAGE_LIMITS.listButtonTextMax) })}
        />
        <p className="text-right text-xs text-muted-foreground">
          {listButtonText.length}/{LIST_MESSAGE_LIMITS.listButtonTextMax}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <Label>{t("omnichannel.automationFlow.editor.listOptions")}</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("omnichannel.automationFlow.editor.listOptionsHint")}
          </p>
        </div>
        {options.map((option, index) => (
          <div key={option.id} className="space-y-2 border-b border-border pb-3 last:border-0">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  value={option.title}
                  maxLength={LIST_MESSAGE_LIMITS.optionTitleMax}
                  placeholder={t("omnichannel.automationFlow.editor.optionName")}
                  onChange={(e) =>
                    updateOption(index, { title: e.target.value.slice(0, LIST_MESSAGE_LIMITS.optionTitleMax) })
                  }
                />
                <Input
                  value={option.description ?? ""}
                  maxLength={LIST_MESSAGE_LIMITS.optionDescriptionMax}
                  placeholder={t("omnichannel.automationFlow.editor.optionDescription")}
                  className="text-sm"
                  onChange={(e) =>
                    updateOption(index, {
                      description: e.target.value.slice(0, LIST_MESSAGE_LIMITS.optionDescriptionMax),
                    })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => removeOption(index)}
                disabled={options.length <= 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={addOption}
          disabled={options.length >= LIST_MESSAGE_LIMITS.maxOptions}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("omnichannel.automationFlow.editor.addOption")}
        </Button>
      </div>
    </div>
  );
}
