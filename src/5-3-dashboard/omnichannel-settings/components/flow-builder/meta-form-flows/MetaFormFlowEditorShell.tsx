import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { FlowBuilderStatusBadge } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/shared/FlowBuilderStatusBadge";
import { FLOW_BUILDER_FORM_FLOWS_PATH } from "@/5-3-dashboard/omnichannel-settings/constants/flowBuilderPaths";
import type { WhatsAppFlowDetail } from "@/5-3-dashboard/omnichannel-settings/hooks/flow-builder/useWhatsAppFlowDetail";
import { usePublishWhatsAppFlow } from "@/5-3-dashboard/omnichannel-settings/hooks/flow-builder/usePublishWhatsAppFlow";
import { useUpdateWhatsAppFlow } from "@/5-3-dashboard/omnichannel-settings/hooks/flow-builder/useWhatsAppFlowDetail";
import { CustomFormFlowEditor } from "@/5-3-whatsapp-template/components/meta-form-flow/CustomFormFlowEditor";
import { CustomFormFlowPreview } from "@/5-3-whatsapp-template/components/meta-form-flow/CustomFormFlowPreview";
import {
  defaultLocalFields,
  newLocalFieldKey,
  type LocalFormField,
} from "@/5-3-whatsapp-template/components/meta-form-flow/customFormFlowEditorTypes";
import { MetaFormFlowJsonEditor } from "@/5-3-whatsapp-template/components/meta-form-flow/MetaFormFlowJsonEditor";
import { buildCustomFormFlowJson } from "@/5-3-whatsapp-template/utils/buildCustomFormFlowJson";
import { parseCustomFormFlowJson } from "@/5-3-whatsapp-template/utils/parseCustomFormFlowJson";
import { validateCustomFormModel } from "@/5-3-whatsapp-template/utils/validateCustomFormFlowJson";
import { normalizeMetaFlowJsonDocument } from "@/5-3-whatsapp-template/utils/normalizeMetaFlowJsonDocument";
import { formatFlowJsonString, validateFlowJsonSyntax } from "@/5-3-whatsapp-template/utils/validateFlowJsonSyntax";
import { cn } from "@/shared/lib/utils";
import type { FlowBuilderListingRow } from "@/5-3-dashboard/omnichannel-settings/types/flowBuilder.types";

type EditorTab = "form" | "json";

function mapStatus(status: string): FlowBuilderListingRow["status"] {
  const u = status.toUpperCase();
  if (u === "DRAFT") return "DRAFT";
  if (u === "PUBLISHED" || u === "ACTIVE") return "ACTIVE";
  return "OTHER";
}

function initFromFlowJson(flowJson: Record<string, unknown> | null): {
  screenTitle: string;
  introText: string;
  fields: LocalFormField[];
  jsonText: string;
  formParseOk: boolean;
} {
  if (!flowJson) {
    const fields = defaultLocalFields();
    const { flowJson: built } = buildCustomFormFlowJson({
      screenTitle: "Form Digital",
      fields: fields.map(({ localKey: _lk, ...rest }) => rest),
    });
    return {
      screenTitle: "Form Digital",
      introText: "",
      fields,
      jsonText: formatFlowJsonString(built),
      formParseOk: true,
    };
  }
  const normalized = normalizeMetaFlowJsonDocument(flowJson) ?? flowJson;
  const parsed = parseCustomFormFlowJson(normalized);
  if (parsed.ok) {
    return {
      screenTitle: parsed.model.screenTitle,
      introText: parsed.model.introText ?? "",
      fields: parsed.model.fields.map((f) => ({ ...f, localKey: newLocalFieldKey() })),
      jsonText: formatFlowJsonString(normalized),
      formParseOk: true,
    };
  }
  return {
    screenTitle: "",
    introText: "",
    fields: defaultLocalFields(),
    jsonText: formatFlowJsonString(normalized),
    formParseOk: false,
  };
}

type MetaFormFlowEditorShellProps = {
  flow: WhatsAppFlowDetail;
  initialFlowJson: Record<string, unknown> | null;
};

export function MetaFormFlowEditorShell({ flow, initialFlowJson }: MetaFormFlowEditorShellProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const updateMutation = useUpdateWhatsAppFlow();
  const publishMutation = usePublishWhatsAppFlow();

  const initial = useMemo(() => initFromFlowJson(initialFlowJson), [initialFlowJson]);
  const [activeTab, setActiveTab] = useState<EditorTab>(initial.formParseOk ? "form" : "json");
  const [screenTitle, setScreenTitle] = useState(initial.screenTitle);
  const [introText, setIntroText] = useState(initial.introText);
  const [fields, setFields] = useState<LocalFormField[]>(initial.fields);
  const [jsonText, setJsonText] = useState(initial.jsonText);
  const [formParseOk, setFormParseOk] = useState(initial.formParseOk);
  const [savedSnapshot, setSavedSnapshot] = useState(initial.jsonText);
  const [metaErrors, setMetaErrors] = useState<string[]>([]);

  const jsonError = useMemo(() => {
    const result = validateFlowJsonSyntax(jsonText);
    return result.ok ? null : result.message;
  }, [jsonText]);

  const flowStatus = mapStatus(flow.status);
  const isDraft = flowStatus === "DRAFT";
  const isPublished = flowStatus === "ACTIVE";

  const buildJsonFromForm = useCallback(() => {
    const model = {
      screenTitle: screenTitle.trim(),
      introText: introText.trim() || undefined,
      fields: fields.map(({ localKey: _lk, ...rest }) => rest),
    };
    const validationErrors = validateCustomFormModel(model);
    if (validationErrors.length > 0) {
      return { ok: false as const, errors: validationErrors.map((e) => e.message) };
    }
    const { flowJson } = buildCustomFormFlowJson(model);
    return { ok: true as const, flowJson, jsonText: formatFlowJsonString(flowJson) };
  }, [fields, introText, screenTitle]);

  const currentJsonForSave = useMemo(() => {
    if (activeTab === "form" && formParseOk) {
      const built = buildJsonFromForm();
      if (built.ok) return built.flowJson;
    }
    const syntax = validateFlowJsonSyntax(jsonText);
    return syntax.ok ? syntax.value : null;
  }, [activeTab, buildJsonFromForm, formParseOk, jsonText]);

  const currentJsonText = useMemo(() => {
    if (activeTab === "form" && formParseOk) {
      const built = buildJsonFromForm();
      if (built.ok) return built.jsonText;
    }
    return jsonText;
  }, [activeTab, buildJsonFromForm, formParseOk, jsonText]);

  const isDirty = currentJsonText !== savedSnapshot;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const syncFormToJson = () => {
    const built = buildJsonFromForm();
    if (!built.ok) {
      toast.error(built.errors.join(" · "));
      return false;
    }
    setJsonText(built.jsonText);
    setFormParseOk(true);
    return true;
  };

  const handleTabChange = (tab: EditorTab) => {
    if (tab === "json" && activeTab === "form" && formParseOk) {
      if (!syncFormToJson()) return;
    }
    if (tab === "form" && activeTab === "json") {
      const syntax = validateFlowJsonSyntax(jsonText);
      if (!syntax.ok) {
        toast.error(t("omnichannel.settings.flowBuilder.formFlowsEditor.fixJsonBeforeForm"));
        return;
      }
      const parsed = parseCustomFormFlowJson(syntax.value);
      if (parsed.ok) {
        setScreenTitle(parsed.model.screenTitle);
        setIntroText(parsed.model.introText ?? "");
        setFields(parsed.model.fields.map((f) => ({ ...f, localKey: newLocalFieldKey() })));
        setFormParseOk(true);
      } else {
        toast.message(t("omnichannel.settings.flowBuilder.formFlowsEditor.formTabUnavailable"));
        setFormParseOk(false);
        return;
      }
    }
    setActiveTab(tab);
  };

  const handleSave = async () => {
    setMetaErrors([]);
    let flowJson = currentJsonForSave;
    if (activeTab === "form" && formParseOk) {
      const built = buildJsonFromForm();
      if (!built.ok) {
        toast.error(built.errors.join(" · "));
        return;
      }
      flowJson = built.flowJson;
      setJsonText(built.jsonText);
    }
    if (!flowJson) {
      toast.error(jsonError ?? t("omnichannel.settings.flowBuilder.formFlowsEditor.invalidJson"));
      return;
    }
    try {
      await updateMutation.mutateAsync({ flow_id: flow.id, flow_json: flowJson });
      const nextText = formatFlowJsonString(flowJson);
      setJsonText(nextText);
      setSavedSnapshot(nextText);
      toast.success(t("omnichannel.settings.flowBuilder.formFlowsEditor.saveSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("omnichannel.settings.flowBuilder.formFlowsEditor.saveFailed"));
    }
  };

  const handlePublish = async () => {
    if (!isDraft) return;
    setMetaErrors([]);
    let flowJson = currentJsonForSave;
    if (activeTab === "form" && formParseOk) {
      const built = buildJsonFromForm();
      if (!built.ok) {
        toast.error(built.errors.join(" · "));
        return;
      }
      flowJson = built.flowJson;
    }
    if (!flowJson) {
      toast.error(jsonError ?? t("omnichannel.settings.flowBuilder.formFlowsEditor.invalidJson"));
      return;
    }
    try {
      if (isDirty) {
        await updateMutation.mutateAsync({ flow_id: flow.id, flow_json: flowJson });
        const nextText = formatFlowJsonString(flowJson);
        setJsonText(nextText);
        setSavedSnapshot(nextText);
      }
      await publishMutation.mutateAsync(flow.id);
      toast.success(t("omnichannel.settings.flowBuilder.formFlows.publishSuccess"));
      navigate(FLOW_BUILDER_FORM_FLOWS_PATH);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("omnichannel.settings.flowBuilder.formFlows.publishFailed"));
    }
  };

  const handleBack = () => {
    if (isDirty && !window.confirm(t("omnichannel.settings.flowBuilder.formFlowsEditor.unsavedConfirm"))) {
      return;
    }
    navigate(FLOW_BUILDER_FORM_FLOWS_PATH);
  };

  const statusLabel =
    flowStatus === "DRAFT"
      ? t("omnichannel.settings.flowBuilder.status.draft")
      : flowStatus === "ACTIVE"
        ? t("omnichannel.settings.flowBuilder.status.active")
        : t("omnichannel.settings.flowBuilder.status.other");

  const previewInvalid = activeTab === "json" && Boolean(jsonError);
  const previewFields = activeTab === "form" && formParseOk ? fields : fields;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-9 px-2" onClick={handleBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("omnichannel.settings.flowBuilder.formFlowsEditor.back")}
          </Button>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-foreground">{flow.name || flow.id}</h3>
            <div className="mt-0.5 flex items-center gap-2">
              <FlowBuilderStatusBadge status={flowStatus} label={statusLabel} />
              {isDirty ? (
                <span className="text-xs text-amber-600">{t("omnichannel.settings.flowBuilder.formFlowsEditor.unsaved")}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={updateMutation.isPending || !currentJsonForSave}
            onClick={() => void handleSave()}
          >
            {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("omnichannel.settings.flowBuilder.formFlowsEditor.save")}
          </Button>
          {isDraft ? (
            <Button
              type="button"
              size="sm"
              disabled={publishMutation.isPending}
              onClick={() => void handlePublish()}
            >
              {publishMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("omnichannel.settings.flowBuilder.formFlows.publish")}
            </Button>
          ) : null}
        </div>
      </div>

      {isPublished ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {t("omnichannel.settings.flowBuilder.formFlowsEditor.publishedEditBanner")}
        </div>
      ) : null}

      {!formParseOk && activeTab === "form" ? (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t("omnichannel.settings.flowBuilder.formFlowsEditor.formTabUnavailable")}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_minmax(0,1fr)]">
        <div className="flex shrink-0 gap-1 border-b border-border px-3 pt-2 lg:col-span-1">
          {(["form", "json"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              disabled={tab === "form" && !formParseOk && activeTab !== "form"}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
                tab === "form" && !formParseOk && activeTab !== "form" && "opacity-50",
              )}
            >
              {tab === "form"
                ? t("omnichannel.settings.flowBuilder.formFlowsEditor.tabForm")
                : t("omnichannel.settings.flowBuilder.formFlowsEditor.tabJson")}
            </button>
          ))}
        </div>

        <div className="hidden border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground lg:col-start-2 lg:block lg:border-l lg:border-b">
          {t("omnichannel.settings.flowBuilder.formFlowsEditor.previewTitle")}
        </div>

        <div className="min-h-0 overflow-y-auto px-4 py-4 lg:col-start-1 lg:row-start-2">
          {activeTab === "form" && formParseOk ? (
            <CustomFormFlowEditor
              screenTitle={screenTitle}
              introText={introText}
              fields={fields}
              onScreenTitleChange={setScreenTitle}
              onIntroTextChange={setIntroText}
              onFieldsChange={setFields}
            />
          ) : (
            <MetaFormFlowJsonEditor value={jsonText} onChange={setJsonText} />
          )}
        </div>

        <div className="min-h-0 overflow-y-auto border-t border-border bg-muted/20 px-4 py-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-t-0">
          <CustomFormFlowPreview
            screenTitle={screenTitle}
            introText={introText}
            fields={previewFields}
            invalidJson={previewInvalid}
          />
        </div>
      </div>

      {(metaErrors.length > 0 || jsonError) && activeTab === "json" ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <p className="font-medium">{t("omnichannel.settings.flowBuilder.formFlowsEditor.flowJsonErrors")}</p>
          {jsonError ? <p>{jsonError}</p> : null}
          {metaErrors.map((msg) => (
            <p key={msg}>{msg}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
