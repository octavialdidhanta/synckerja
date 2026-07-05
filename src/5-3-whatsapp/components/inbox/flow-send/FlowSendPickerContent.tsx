import { type Dispatch, type SetStateAction } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { WhatsAppTemplatePhonePreview } from "@/5-3-whatsapp-template/components/WhatsAppTemplatePhonePreview";
import type { FollowUpPickerOption, FlowFollowUpFilterMode } from "../../../hooks/useWhatsAppFlowFollowUpCatalog";
import type { useLivechatFlowSendForm } from "../../../hooks/useLivechatFlowSendForm";

type FlowSendFormState = ReturnType<typeof useLivechatFlowSendForm>;

type FlowSendPickerContentProps = {
  mode: FlowFollowUpFilterMode;
  waAccountId: string | null;
  form: Pick<
    FlowSendFormState,
    | "catalog"
    | "sessionOpen"
    | "selectionValue"
    | "setSelectionValue"
    | "parameterValues"
    | "setParameterValues"
    | "senderLabel"
    | "previewRow"
    | "previewSamples"
    | "selectedSessionFlow"
    | "isSessionFlow"
    | "slotCount"
    | "templateDetail"
    | "sessionFlowOptions"
    | "flowTemplateOptions"
    | "otherTemplateOptions"
    | "isEmptyCatalog"
  >;
  isMobile?: boolean;
  /** Flow-send dialog: hide sender, manage link, hints, empty preview placeholder. */
  minimalChrome?: boolean;
};

export function FlowSendPickerContent({ mode, waAccountId, form, isMobile, minimalChrome }: FlowSendPickerContentProps) {
  const { t } = useAppTranslation();
  const {
    catalog,
    sessionOpen,
    selectionValue,
    setSelectionValue,
    parameterValues,
    setParameterValues,
    senderLabel,
    previewRow,
    previewSamples,
    selectedSessionFlow,
    isSessionFlow,
    slotCount,
    templateDetail,
    sessionFlowOptions,
    flowTemplateOptions,
    otherTemplateOptions,
    isEmptyCatalog,
  } = form;

  const compact = Boolean(isMobile || minimalChrome);
  const showPreviewPanel = !compact || isSessionFlow || previewRow;

  return (
    <div
      className={cn(
        "grid min-w-0",
        isMobile ? "gap-3" : compact ? "gap-4" : "gap-6 grid-cols-1 lg:grid-cols-2",
        !isMobile && showPreviewPanel && compact && "grid-cols-1 lg:grid-cols-2",
      )}
    >
      <div className="min-w-0 space-y-3">
        {!compact ? (
          <div className="space-y-2">
            <Label>{t("whatsappInbox.followUp.sender", "Nomor pengirim")}</Label>
            <p className="text-sm font-medium text-foreground">{senderLabel}</p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label className={cn(compact && "text-xs")}>
            {compact
              ? t("whatsappInbox.flowSend.templateLabelShort", "Template")
              : t("whatsappInbox.followUp.template", "Template pesan")}
          </Label>
          <Select
            value={selectionValue}
            onValueChange={setSelectionValue}
            disabled={!waAccountId || catalog.isLoading || isEmptyCatalog}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("whatsappInbox.followUp.selectTemplate", "Pilih template…")} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {sessionFlowOptions.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Flow (session · 24 jam)</SelectLabel>
                  {sessionFlowOptions.map((opt: FollowUpPickerOption) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {flowTemplateOptions.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Flow Templates (approved)</SelectLabel>
                  {flowTemplateOptions.map((opt: FollowUpPickerOption) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {mode === "all" && otherTemplateOptions.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Other templates</SelectLabel>
                  {otherTemplateOptions.map((opt: FollowUpPickerOption) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
          {!sessionOpen && !compact ? (
            <p className="text-xs text-muted-foreground">
              {t(
                "whatsappInbox.followUp.sessionClosedHint",
                "Jendela 24 jam berakhir — hanya template Flow yang dapat dikirim.",
              )}
            </p>
          ) : null}
          {catalog.isLoading ? (
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {t("whatsappInbox.followUp.loadingTemplates", "Memuat template…")}
            </p>
          ) : null}
          {isEmptyCatalog && !catalog.isLoading ? (
            <p className="text-xs text-muted-foreground">
              {mode === "flow_only"
                ? t(
                    "whatsappInbox.flowSend.emptyCatalog",
                    "Belum ada Flow aktif atau Flow Template yang disetujui.",
                  )
                : t("whatsappInbox.followUp.needTemplate", "Pilih template pesan.")}
            </p>
          ) : null}
        </div>

        {slotCount > 0 ? (
          <div className="space-y-2">
            <Label>{t("whatsappInbox.followUp.variables", "Variabel template")}</Label>
            {Array.from({ length: slotCount }, (_, i) => (
              <FlowSendVariableInput
                key={i}
                index={i}
                value={parameterValues[i] ?? ""}
                slotCount={slotCount}
                onChange={setParameterValues}
              />
            ))}
          </div>
        ) : null}

        {!compact ? (
          <p className="text-xs text-muted-foreground">
            <Link
              to="/omnichannel/campaign/templates"
              className="font-medium text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("whatsappInbox.followUp.manageTemplates", "Kelola template")}
            </Link>
          </p>
        ) : null}
      </div>

      {showPreviewPanel ? (
        <div className={cn("flex min-h-0 flex-col items-center justify-start", isMobile && "pt-1")}>
        {isSessionFlow && selectedSessionFlow ? (
          <div className="w-full max-w-[280px] rounded-2xl border border-slate-200 bg-[#ece5dd] p-4 shadow-sm">
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <p className="text-sm text-foreground">
                {t("whatsappInbox.followUp.flowSessionBody", "Silakan isi form berikut.")}
              </p>
              <div className="mt-3 flex justify-center">
                <span className="rounded-md bg-[#25D366] px-4 py-2 text-sm font-medium text-white">View flow</span>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">{selectedSessionFlow.name}</p>
            </div>
          </div>
        ) : previewRow ? (
          <WhatsAppTemplatePhonePreview
            headerText={previewRow.headerText}
            mediaFormat={previewRow.mediaFormat}
            headerMediaPreviewUrl={previewRow.headerMediaPreviewUrl}
            bodyText={previewRow.bodyFull}
            bodyVariableExamples={
              previewSamples?.bodyVariableExamples?.length
                ? previewSamples.bodyVariableExamples
                : previewRow.bodyVariableExamples
            }
            headerVariableExamples={
              previewSamples?.headerVariableExamples?.length
                ? previewSamples.headerVariableExamples
                : previewRow.headerVariableExamples
            }
            footerText={previewRow.footerText}
            buttonLabels={previewRow.previewButtonLabels}
            previewAt={previewRow.lastEditedAt ?? previewRow.createdAt}
            metaSyncLoading={templateDetail.isFetching}
          />
        ) : !compact ? (
          <p className="text-sm text-muted-foreground">
            {t("whatsappInbox.followUp.previewHint", "Pilih template untuk melihat preview.")}
          </p>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}

function FlowSendVariableInput({
  index,
  value,
  slotCount,
  onChange,
}: {
  index: number;
  value: string;
  slotCount: number;
  onChange: Dispatch<SetStateAction<string[]>>;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{`{{${index + 1}}}`}</Label>
      <Input
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange((prev) => {
            const next = [...prev];
            while (next.length < slotCount) next.push("");
            next[index] = v;
            return next;
          });
        }}
        maxLength={1024}
      />
    </div>
  );
}
