import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, Loader2 } from "lucide-react";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { WhatsappRecipientListDetailPayload } from "@/5-3-whatsapp-template/hooks/useWhatsappRecipientLists";
import type { TemplateTableRow } from "@/5-3-whatsapp-template/types";
import {
  deriveTemplateContentKind,
  extractTemplateParameterSlots,
  getListCreationSource,
  getMappableFieldOptions,
  mappableFieldLabel,
  type MappableFieldKey,
  type VariableMapping,
} from "@/5-3-whatsapp-template/utils/campaignTemplateContent";

export type CampaignContentSectionProps = {
  previewRow: TemplateTableRow | null;
  componentsJson: unknown[];
  listDetail: WhatsappRecipientListDetailPayload | null | undefined;
  listId: string;
  templateHsmId: string;
  variableMapping: VariableMapping;
  onMappingChange: (next: VariableMapping) => void;
  templateLoading?: boolean;
  listLoading?: boolean;
};

function buildMessagePreviewText(previewRow: TemplateTableRow | null): string {
  if (!previewRow) return "";
  const parts: string[] = [];
  const header = previewRow.headerText?.trim();
  if (header) parts.push(header);
  const body = previewRow.bodyFull?.trim();
  if (body) parts.push(body);
  return parts.join("\n\n");
}

export function CampaignContentSection({
  previewRow,
  componentsJson,
  listDetail,
  listId,
  templateHsmId,
  variableMapping,
  onMappingChange,
  templateLoading = false,
  listLoading = false,
}: CampaignContentSectionProps) {
  const { t } = useTranslation();

  const slots = useMemo(() => extractTemplateParameterSlots(componentsJson), [componentsJson]);
  const contentKind = useMemo(() => deriveTemplateContentKind(componentsJson), [componentsJson]);
  const creationSource = getListCreationSource(listDetail);
  const fieldOptions = useMemo(
    () => getMappableFieldOptions(creationSource),
    [creationSource],
  );

  const messageText = buildMessagePreviewText(previewRow);
  const buttonLabels = previewRow?.previewButtonLabels ?? [];
  const mediaFormat = previewRow?.mediaFormat;
  const mediaUrl = previewRow?.headerMediaPreviewUrl;

  if (!listId || !templateHsmId) return null;
  if (templateLoading || listLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        <span>{t("whatsappTemplates.campaign.content.loading")}</span>
      </div>
    );
  }
  if (contentKind === "hidden" || !previewRow) return null;

  const showMapping = slots.length > 0;
  const showMedia =
    contentKind === "withMediaHeader" || contentKind === "withMediaAndVariables";
  const mappingIncomplete =
    showMapping && slots.some((s) => !variableMapping[s.index]);

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-gray-200 bg-muted/20 p-4">
      <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          {t("whatsappTemplates.campaign.content.title")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("whatsappTemplates.campaign.content.intro")}
        </p>
      </div>

      {showMedia ? (
        <div className="space-y-2">
          <Label>{t("whatsappTemplates.campaign.content.mediaHeader")}</Label>
          <div className="flex gap-3 rounded-md border border-border bg-background p-3">
            {mediaUrl ? (
              <img
                src={mediaUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-muted">
                <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
              </div>
            )}
            <div className="min-w-0 flex-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                {mediaFormat ?? "MEDIA"}
              </p>
              <p className="mt-1">{t("whatsappTemplates.campaign.content.mediaHeaderHint")}</p>
            </div>
          </div>
        </div>
      ) : null}

      {messageText ? (
        <div className="space-y-2">
          <Label>{t("whatsappTemplates.campaign.content.message")}</Label>
          <div className="max-h-48 overflow-x-hidden overflow-y-auto break-words whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm text-slate-800">
            {messageText}
          </div>
        </div>
      ) : null}

      {showMapping ? (
        <div className="min-w-0 space-y-3">
          <Label>{t("whatsappTemplates.campaign.content.variableMapping")}</Label>
          {!listDetail?.members?.length ? (
            <p className="text-xs text-amber-800">{t("whatsappTemplates.campaign.content.needList")}</p>
          ) : (
            <ul className="scrollbar-hide max-h-[min(17.5rem,38vh)] min-w-0 space-y-2 overflow-x-hidden overflow-y-auto pr-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {slots.map((slot) => (
                <li
                  key={slot.index}
                  className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2"
                >
                  <span className="shrink-0 font-mono text-sm font-medium text-slate-700">{slot.label}</span>
                  <div className="min-w-0 w-full">
                    <Select
                      value={variableMapping[slot.index] ?? ""}
                      onValueChange={(v) =>
                        onMappingChange({
                          ...variableMapping,
                          [slot.index]: v as MappableFieldKey,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 w-full min-w-0 max-w-full bg-background">
                        <SelectValue
                          className="truncate"
                          placeholder={t("whatsappTemplates.campaign.content.selectField")}
                        />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        className="max-w-[min(24rem,calc(100vw-2rem))]"
                        collisionPadding={12}
                      >
                        {fieldOptions.map((f) => (
                          <SelectItem key={f.key} value={f.key} className="truncate">
                            {t(f.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {mappingIncomplete ? (
            <p className="text-xs text-amber-800">{t("whatsappTemplates.campaign.content.needMapping")}</p>
          ) : null}
        </div>
      ) : null}

      {buttonLabels.length > 0 ? (
        <div className="space-y-2">
          <Label>{t("whatsappTemplates.campaign.content.buttons")}</Label>
          <ul className="space-y-1.5">
            {buttonLabels.map((label, i) => (
              <li
                key={`${label}-${i}`}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-slate-800"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!showMapping && !showMedia && !messageText && buttonLabels.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("whatsappTemplates.campaign.content.empty")}</p>
      ) : null}
      </div>
    </div>
  );
}

/** Read-only mapping rows for campaign detail panel. */
export function CampaignParameterMappingReadOnly({
  parameterMapping,
}: {
  parameterMapping: Record<string, string> | null | undefined;
}) {
  const { t } = useTranslation();
  const parsed = useMemo(() => {
    if (!parameterMapping || typeof parameterMapping !== "object") return [];
    return Object.entries(parameterMapping)
      .map(([k, v]) => ({ slot: Number(k), key: String(v) as MappableFieldKey }))
      .filter((e) => Number.isFinite(e.slot) && e.slot >= 1)
      .sort((a, b) => a.slot - b.slot);
  }, [parameterMapping]);

  if (parsed.length === 0) return null;

  return (
    <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-800">
        {t("whatsappTemplates.campaign.content.variableMapping")}
      </h3>
      <ul className="space-y-1.5 text-sm">
        {parsed.map(({ slot, key }) => (
          <li key={slot} className="flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="font-mono text-slate-600">{`{{${slot}}}`}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium text-slate-900">{mappableFieldLabel(key, t)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
