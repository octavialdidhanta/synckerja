import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import type { CustomFormField, CustomFormFieldInputType } from "@/5-3-whatsapp-template/utils/buildCustomFormFlowJson";
import {
  slugFieldNameFromLabel,
  type LocalFormField,
} from "@/5-3-whatsapp-template/components/meta-form-flow/customFormFlowEditorTypes";

type CustomFormFlowEditorProps = {
  screenTitle: string;
  introText: string;
  fields: LocalFormField[];
  onScreenTitleChange: (value: string) => void;
  onIntroTextChange: (value: string) => void;
  onFieldsChange: (fields: LocalFormField[]) => void;
  showApiName?: boolean;
  apiName?: string;
  onApiNameChange?: (value: string) => void;
  readOnly?: boolean;
};

export function CustomFormFlowEditor({
  screenTitle,
  introText,
  fields,
  onScreenTitleChange,
  onIntroTextChange,
  onFieldsChange,
  showApiName = false,
  apiName = "",
  onApiNameChange,
  readOnly = false,
}: CustomFormFlowEditorProps) {
  const { t } = useTranslation();

  const addField = () => {
    const idx = fields.length;
    onFieldsChange([
      ...fields,
      {
        localKey: `lf_${Date.now()}`,
        name: `field_${idx + 1}`,
        label: "",
        instructions: "",
        inputType: "text",
        required: false,
      },
    ]);
  };

  const removeField = (localKey: string) => {
    if (fields.length <= 1) return;
    onFieldsChange(fields.filter((f) => f.localKey !== localKey));
  };

  const updateField = (localKey: string, patch: Partial<CustomFormField>) => {
    onFieldsChange(fields.map((f) => (f.localKey === localKey ? { ...f, ...patch } : f)));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="flow-screen-title">{t("omnichannel.settings.flowBuilder.formFlowsEditor.screenTitle")}</Label>
        <Input
          id="flow-screen-title"
          value={screenTitle}
          onChange={(e) => onScreenTitleChange(e.target.value.slice(0, 60))}
          maxLength={60}
          disabled={readOnly}
        />
        <p className="text-right text-xs tabular-nums text-muted-foreground">{screenTitle.length}/60</p>
      </div>

      {showApiName && onApiNameChange ? (
        <div className="space-y-1">
          <Label htmlFor="flow-api-name">{t("omnichannel.settings.flowBuilder.formFlowsEditor.apiName")}</Label>
          <Input
            id="flow-api-name"
            value={apiName}
            onChange={(e) =>
              onApiNameChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 128))
            }
            className="font-mono text-sm"
            disabled={readOnly}
          />
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="flow-intro">{t("omnichannel.settings.flowBuilder.formFlowsEditor.introOptional")}</Label>
        <textarea
          id="flow-intro"
          value={introText}
          onChange={(e) => onIntroTextChange(e.target.value.slice(0, 4096))}
          disabled={readOnly}
          className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        {t("omnichannel.settings.flowBuilder.formFlowsEditor.fieldNamingHint")}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{t("omnichannel.settings.flowBuilder.formFlowsEditor.fields")}</Label>
          {!readOnly ? (
            <Button type="button" variant="outline" size="sm" onClick={addField}>
              {t("omnichannel.settings.flowBuilder.formFlowsEditor.addField")}
            </Button>
          ) : null}
        </div>
        <div className="space-y-3">
          {fields.map((f, index) => (
            <div key={f.localKey} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600">
                  {t("omnichannel.settings.flowBuilder.formFlowsEditor.fieldNumber", { n: index + 1 })}
                </span>
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive"
                    disabled={fields.length <= 1}
                    onClick={() => removeField(f.localKey)}
                  >
                    {t("omnichannel.settings.flowBuilder.formFlowsEditor.removeField")}
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("omnichannel.settings.flowBuilder.formFlowsEditor.fieldLabel")}</Label>
                  <Input
                    value={f.label}
                    onChange={(e) => updateField(f.localKey, { label: e.target.value.slice(0, 20) })}
                    maxLength={20}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("omnichannel.settings.flowBuilder.formFlowsEditor.fieldName")}</Label>
                  <Input
                    value={f.name}
                    onChange={(e) =>
                      updateField(f.localKey, {
                        name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 64),
                      })
                    }
                    className="font-mono text-xs"
                    disabled={readOnly}
                  />
                  {!readOnly ? (
                    <button
                      type="button"
                      className="text-[10px] text-primary hover:underline"
                      onClick={() => updateField(f.localKey, { name: slugFieldNameFromLabel(f.label, index) })}
                    >
                      {t("omnichannel.settings.flowBuilder.formFlowsEditor.generateFromLabel")}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("omnichannel.settings.flowBuilder.formFlowsEditor.instructionsOptional")}</Label>
                <Input
                  value={f.instructions ?? ""}
                  onChange={(e) => updateField(f.localKey, { instructions: e.target.value.slice(0, 80) })}
                  maxLength={80}
                  disabled={readOnly}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">{t("omnichannel.settings.flowBuilder.formFlowsEditor.inputType")}</Label>
                  <Select
                    value={f.inputType}
                    onValueChange={(v) => updateField(f.localKey, { inputType: v as CustomFormFieldInputType })}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-8 w-[10rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch
                    id={`req-${f.localKey}`}
                    checked={f.required}
                    onCheckedChange={(c) => updateField(f.localKey, { required: Boolean(c) })}
                    disabled={readOnly}
                  />
                  <Label htmlFor={`req-${f.localKey}`} className="text-xs">
                    {t("omnichannel.settings.flowBuilder.formFlowsEditor.required")}
                  </Label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
