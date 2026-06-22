import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
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
import {
  countTemplateBodySlots,
  useApprovedWhatsAppTemplatesFlat,
} from "@/5-3-dashboard/omnichannel-settings/hooks/useApprovedWhatsAppTemplatesFlat";
import type { WhatsAppTemplateSelection } from "@/5-3-dashboard/omnichannel-settings/components/api-integration/WhatsAppTemplatePicker";
import { WhatsAppTemplatePicker } from "@/5-3-dashboard/omnichannel-settings/components/api-integration/WhatsAppTemplatePicker";
import { ClickInfoHint } from "@/5-3-dashboard/omnichannel-settings/components/api-integration/ClickInfoHint";
import {
  buildLeadMappableFieldOptions,
  isLeadMappingComplete,
  parameterMappingToRecord,
  recordToParameterMapping,
} from "@/5-3-dashboard/omnichannel-settings/lib/leadTemplateMappableFields";
import {
  buildLeadTemplateBodyPreviewText,
  type LeadPreviewSubmission,
} from "@/5-3-dashboard/omnichannel-settings/lib/leadTemplatePreview";
import {
  useLatestLeadSubmissionForPreview,
  useLeadMappingWebIds,
  useLeadTemplateMapping,
  useRecentLeadFormDataKeys,
  useSuggestLeadTemplateMapping,
} from "@/5-3-dashboard/omnichannel-settings/hooks/useOmnichannelApiIntegration";
import { WhatsAppTemplatePhonePreview } from "@/5-3-whatsapp-template/components/WhatsAppTemplatePhonePreview";

function rowLanguageCode(languageCode: string): string {
  return languageCode === "—" ? "id" : languageCode;
}

/** Shared grid: label | arrow | value select (aligned across web_id + {{n}} rows). */
const mapperRowGridClass =
  "grid grid-cols-[3rem_auto_minmax(200px,20rem)] items-center gap-x-2 sm:gap-x-3";

const mapperSelectTriggerClass = "h-9 w-full min-w-0 font-mono text-sm";

function slotMappingsEqual(
  a: Record<number, string>,
  b: Record<number, string>,
  slotCount: number,
): boolean {
  if (slotCount <= 0) return Object.keys(a).length === 0 && Object.keys(b).length === 0;
  for (let slot = 1; slot <= slotCount; slot++) {
    if ((a[slot] ?? "").trim() !== (b[slot] ?? "").trim()) return false;
  }
  return true;
}

export type LeadTemplateVariableMapperProps = {
  organizationId: string | null | undefined;
  template: WhatsAppTemplateSelection | null;
  onTemplateChange?: (next: WhatsAppTemplateSelection | null) => void;
  leadMappingComplete?: boolean;
  disabled?: boolean;
  queryEnabled?: boolean;
  onMappingChange?: (mapping: Record<string, string> | null) => void;
  onWebIdChange?: (webId: string) => void;
  onCompleteChange?: (complete: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function LeadTemplateVariableMapper({
  organizationId,
  template,
  onTemplateChange,
  leadMappingComplete = false,
  disabled = false,
  queryEnabled = true,
  onMappingChange,
  onWebIdChange,
  onCompleteChange,
  onDirtyChange,
}: LeadTemplateVariableMapperProps) {
  const { t } = useTranslation();
  const [webId, setWebId] = useState<string>("");
  const [slotMapping, setSlotMapping] = useState<Record<number, string>>({});
  const [loadedBaseline, setLoadedBaseline] = useState<Record<number, string>>({});
  const [suggestLoadedKey, setSuggestLoadedKey] = useState("");
  const userEditedRef = useRef(false);

  const templateName = template?.name.trim() ?? "";
  const templateLanguage = (template?.language ?? "id").trim() || "id";

  const { data: webIds = [], isLoading: webIdsLoading } = useLeadMappingWebIds(organizationId, {
    enabled: queryEnabled && Boolean(templateName),
  });

  const { rows, isLoading: templatesLoading } = useApprovedWhatsAppTemplatesFlat({
    enabled: queryEnabled,
  });

  const matchedTemplate = useMemo(() => {
    if (!templateName) return undefined;
    return rows.find(
      (row) =>
        row.templateName === templateName &&
        rowLanguageCode(row.languageCode) === templateLanguage,
    );
  }, [rows, templateName, templateLanguage]);

  const bodySlotCount = matchedTemplate ? countTemplateBodySlots(matchedTemplate) : 0;

  const { data: savedMapping, isLoading: mappingLoading } = useLeadTemplateMapping(
    organizationId,
    webId && templateName
      ? { web_id: webId, template_name: templateName, template_language: templateLanguage }
      : null,
    { enabled: queryEnabled && Boolean(webId && templateName) },
  );

  const {
    data: previewBundle,
    isLoading: submissionLoading,
    isFetching: submissionFetching,
    refetch: refetchSubmission,
  } = useLatestLeadSubmissionForPreview(organizationId, webId || null, {
    enabled: queryEnabled && Boolean(webId),
  });

  const { data: recentFormDataKeys = [], refetch: refetchFormDataKeys } = useRecentLeadFormDataKeys(
    organizationId,
    webId || null,
    { enabled: queryEnabled && Boolean(webId) },
  );

  const latestSubmission = previewBundle?.submission ?? null;

  const suggestMapping = useSuggestLeadTemplateMapping(organizationId);

  const mapperFormDataKeys = useMemo(() => {
    if (previewBundle?.formDataKeys?.length) return previewBundle.formDataKeys;
    if (recentFormDataKeys.length) return recentFormDataKeys;
    return [];
  }, [previewBundle?.formDataKeys, recentFormDataKeys]);

  const fieldOptions = useMemo(
    () => buildLeadMappableFieldOptions(mapperFormDataKeys),
    [mapperFormDataKeys],
  );

  const fieldOptionKeys = useMemo(() => new Set(fieldOptions.map((f) => f.key)), [fieldOptions]);

  const mappingComplete = useMemo(
    () => isLeadMappingComplete(slotMapping, bodySlotCount),
    [slotMapping, bodySlotCount],
  );

  const isMappingDirty = useMemo(() => {
    if (!mappingComplete || !webId) return false;
    for (let slot = 1; slot <= bodySlotCount; slot++) {
      if ((slotMapping[slot] ?? "").trim() !== (loadedBaseline[slot] ?? "").trim()) {
        return true;
      }
    }
    return false;
  }, [slotMapping, loadedBaseline, mappingComplete, bodySlotCount, webId]);

  const applyLoadedMapping = useCallback((mapping: Record<number, string>) => {
    setSlotMapping((prev) => (slotMappingsEqual(prev, mapping, bodySlotCount) ? prev : mapping));
    setLoadedBaseline((prev) => (slotMappingsEqual(prev, mapping, bodySlotCount) ? prev : mapping));
    userEditedRef.current = false;
  }, [bodySlotCount]);

  const slotMappingRef = useRef(slotMapping);
  slotMappingRef.current = slotMapping;

  useEffect(() => {
    if (!webId && webIds.length > 0) {
      setWebId(webIds[0]!);
    }
  }, [webId, webIds]);

  useEffect(() => {
    setSlotMapping({});
    setLoadedBaseline({});
    userEditedRef.current = false;
    setSuggestLoadedKey("");
  }, [organizationId, templateName, templateLanguage, webId]);

  const mappingLoadKey = `${webId}::${templateName}::${templateLanguage}`;

  useEffect(() => {
    if (!webId || !templateName) return;

    if (savedMapping?.parameter_mapping) {
      const fromDb = parameterMappingToRecord(savedMapping.parameter_mapping);
      if (Object.keys(fromDb).length > 0) {
        if (
          !userEditedRef.current &&
          !slotMappingsEqual(fromDb, slotMappingRef.current, bodySlotCount)
        ) {
          applyLoadedMapping(fromDb);
        }
        return;
      }
    }

    if (userEditedRef.current) return;

    if (bodySlotCount <= 0 || suggestLoadedKey === mappingLoadKey || suggestMapping.isPending) {
      return;
    }

    setSuggestLoadedKey(mappingLoadKey);
    void suggestMapping
      .mutateAsync({
        web_id: webId,
        template_name: templateName,
        template_language: templateLanguage,
      })
      .then((res) => {
        if (userEditedRef.current) return;
        applyLoadedMapping(
          parameterMappingToRecord((res.parameter_mapping ?? {}) as Record<string, string>),
        );
      })
      .catch(() => {
        setSuggestLoadedKey("");
      });
  }, [
    savedMapping,
    bodySlotCount,
    webId,
    templateName,
    templateLanguage,
    mappingLoadKey,
    suggestLoadedKey,
    suggestMapping,
    applyLoadedMapping,
  ]);

  useEffect(() => {
    onCompleteChange?.(mappingComplete && Boolean(webId));
  }, [mappingComplete, webId, onCompleteChange]);

  useEffect(() => {
    onDirtyChange?.(isMappingDirty);
  }, [isMappingDirty, onDirtyChange]);

  useEffect(() => {
    if (webId) onWebIdChange?.(webId);
  }, [webId, onWebIdChange]);

  useEffect(() => {
    if (!mappingComplete || !webId) {
      onMappingChange?.(null);
      return;
    }
    onMappingChange?.(recordToParameterMapping(slotMapping));
  }, [slotMapping, mappingComplete, webId, onMappingChange]);

  const bodySlots = useMemo(() => {
    if (bodySlotCount <= 0) return [];
    return Array.from({ length: bodySlotCount }, (_, i) => i + 1);
  }, [bodySlotCount]);

  const previewSubmission = useMemo((): LeadPreviewSubmission | null => {
    if (!latestSubmission) return null;
    return {
      name: latestSubmission.name,
      email: latestSubmission.email,
      phone_number: latestSubmission.phone_number,
      notes: latestSubmission.notes,
      form_data: latestSubmission.form_data,
      submitted_at: latestSubmission.submitted_at,
    };
  }, [latestSubmission]);

  const livePreview = useMemo(() => {
    if (!matchedTemplate || !mappingComplete || bodySlotCount <= 0) return null;

    const bodyText = buildLeadTemplateBodyPreviewText(
      matchedTemplate.bodyFull,
      slotMapping,
      bodySlotCount,
      previewSubmission,
    );

    return {
      bodyText,
      submittedAt: previewSubmission?.submitted_at ?? null,
    };
  }, [matchedTemplate, mappingComplete, bodySlotCount, slotMapping, previewSubmission]);

  const phonePreviewProps = useMemo(() => {
    if (!matchedTemplate) return null;

    if (livePreview) {
      return {
        headerText: matchedTemplate.headerText,
        mediaFormat: matchedTemplate.mediaFormat,
        headerMediaPreviewUrl: matchedTemplate.headerMediaPreviewUrl,
        bodyText: livePreview.bodyText,
        bodyVariableExamples: null as string[] | null,
        headerVariableExamples: null as string[] | null,
        footerText: matchedTemplate.footerText,
        buttonLabels: matchedTemplate.previewButtonLabels,
        previewAt: livePreview.submittedAt ? new Date(livePreview.submittedAt) : new Date(),
      };
    }

    return {
      headerText: matchedTemplate.headerText,
      mediaFormat: matchedTemplate.mediaFormat,
      headerMediaPreviewUrl: matchedTemplate.headerMediaPreviewUrl,
      bodyText: matchedTemplate.bodyFull,
      bodyVariableExamples: matchedTemplate.bodyVariableExamples,
      headerVariableExamples: matchedTemplate.headerVariableExamples,
      footerText: matchedTemplate.footerText,
      buttonLabels: matchedTemplate.previewButtonLabels,
      previewAt: matchedTemplate.lastEditedAt ?? matchedTemplate.createdAt,
    };
  }, [matchedTemplate, livePreview]);

  const handleSlotChange = useCallback((slot: number, fieldKey: string) => {
    userEditedRef.current = true;
    setSlotMapping((prev) => ({ ...prev, [slot]: fieldKey }));
  }, []);

  const handleRefreshPreviewData = useCallback(() => {
    void refetchSubmission();
    void refetchFormDataKeys();
  }, [refetchSubmission, refetchFormDataKeys]);

  const isLoading = webIdsLoading || templatesLoading || mappingLoading;
  const previewLoading = submissionLoading || submissionFetching;
  const noWebIds = !webIdsLoading && webIds.length === 0;

  const templatePickerBlock = (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label htmlFor="wa-lead-template" className="text-sm font-medium">
          {t("omnichannel.settings.apiIntegration.waLeadTemplateLabel")}
        </Label>
        <ClickInfoHint content={t("omnichannel.settings.apiIntegration.waLeadTemplateHint")} />
      </div>
      <WhatsAppTemplatePicker
        id="wa-lead-template"
        purpose="lead"
        value={template}
        onChange={(next) => onTemplateChange?.(next)}
        disabled={disabled}
        queryEnabled={queryEnabled}
        leadMappingComplete={leadMappingComplete}
        hideApprovedHint
      />
    </div>
  );

  const phonePreviewColumn = phonePreviewProps ? (
    <div className="flex shrink-0 flex-col items-start self-start overflow-hidden pb-2 pr-2 lg:ml-6 lg:pl-4">
      <div className="overflow-hidden rounded-[2rem]">
        <WhatsAppTemplatePhonePreview
          className="w-auto"
          variant="embedded"
          headerText={phonePreviewProps.headerText}
          mediaFormat={phonePreviewProps.mediaFormat}
          headerMediaPreviewUrl={phonePreviewProps.headerMediaPreviewUrl}
          bodyText={phonePreviewProps.bodyText}
          bodyVariableExamples={phonePreviewProps.bodyVariableExamples}
          headerVariableExamples={phonePreviewProps.headerVariableExamples}
          footerText={phonePreviewProps.footerText}
          buttonLabels={phonePreviewProps.buttonLabels}
          previewAt={phonePreviewProps.previewAt}
          metaSyncLoading={previewLoading && mappingComplete}
        />
      </div>
    </div>
  ) : null;

  return (
    <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-4">
      {!templateName ? (
        <div className="max-w-md">{templatePickerBlock}</div>
      ) : webId && bodySlotCount > 0 ? (
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:gap-12 lg:overflow-hidden">
          <div className="w-full max-w-md shrink-0 space-y-3">
            {templatePickerBlock}
                <div className={mapperRowGridClass}>
                  <Label
                    htmlFor="lead-mapper-web-id"
                    className="font-mono text-xs font-medium leading-tight text-foreground"
                  >
                    web_id
                  </Label>
                  <span className="text-muted-foreground" aria-hidden>
                    →
                  </span>
                  <Select
                    value={webId || undefined}
                    onValueChange={(value) => {
                      setWebId(value);
                      userEditedRef.current = false;
                    }}
                    disabled={disabled || noWebIds || isLoading}
                  >
                    <SelectTrigger id="lead-mapper-web-id" className={mapperSelectTriggerClass}>
                      <SelectValue
                        placeholder={t("omnichannel.settings.apiIntegration.leadMapper.webIdPlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {webIds.map((id) => (
                        <SelectItem key={id} value={id} className="font-mono text-sm">
                          {id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {noWebIds ? (
                  <p className="pl-[calc(3rem+1.75rem)] text-xs text-amber-800 dark:text-amber-200 sm:pl-[calc(3rem+2rem)]">
                    {t("omnichannel.settings.apiIntegration.leadMapper.noWebIds")}
                  </p>
                ) : null}
            {bodySlots.map((slot) => {
              const currentField = (slotMapping[slot] ?? "").trim();
              const staleField =
                currentField && !fieldOptionKeys.has(currentField) ? currentField : null;

              return (
              <div key={slot} className={mapperRowGridClass}>
                <span className="font-mono text-sm text-muted-foreground">{`{{${slot}}}`}</span>
                <span className="text-muted-foreground" aria-hidden>
                  →
                </span>
                <Select
                  value={slotMapping[slot] ?? ""}
                  onValueChange={(value) => handleSlotChange(slot, value)}
                  disabled={disabled || isLoading}
                >
                  <SelectTrigger className={mapperSelectTriggerClass}>
                    <SelectValue placeholder={t("omnichannel.settings.apiIntegration.leadMapper.fieldPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {staleField ? (
                      <SelectGroup>
                        <SelectItem
                          value={staleField}
                          className="font-mono text-sm text-amber-800 dark:text-amber-200"
                        >
                          {t("omnichannel.settings.apiIntegration.leadMapper.fieldStale", {
                            key: staleField,
                          })}
                        </SelectItem>
                      </SelectGroup>
                    ) : null}
                    <SelectGroup>
                      <SelectLabel>{t("omnichannel.settings.apiIntegration.leadMapper.group.core")}</SelectLabel>
                      {fieldOptions
                        .filter((f) => f.group === "core")
                        .map((f) => (
                          <SelectItem key={f.key} value={f.key} className="font-mono text-sm">
                            {t(f.labelKey)}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                    {fieldOptions.some((f) => f.group === "form_common") ? (
                      <SelectGroup>
                        <SelectLabel>{t("omnichannel.settings.apiIntegration.leadMapper.group.formCommon")}</SelectLabel>
                        {fieldOptions
                          .filter((f) => f.group === "form_common")
                          .map((f) => (
                            <SelectItem key={f.key} value={f.key} className="font-mono text-sm">
                              {t(f.labelKey)}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    ) : null}
                    {fieldOptions.some((f) => f.group === "custom") ? (
                      <SelectGroup>
                        <SelectLabel>{t("omnichannel.settings.apiIntegration.leadMapper.group.custom")}</SelectLabel>
                        {fieldOptions
                          .filter((f) => f.group === "custom")
                          .map((f) => (
                            <SelectItem key={f.key} value={f.key} className="font-mono text-sm">
                              {f.key}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
            );
            })}

            {!mappingComplete ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                {t("omnichannel.settings.apiIntegration.leadMapper.incomplete", { count: bodySlotCount })}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || !mappingComplete || previewLoading}
                onClick={handleRefreshPreviewData}
              >
                {previewLoading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t("omnichannel.settings.apiIntegration.leadMapper.preview")}
              </Button>
            </div>
          </div>

          {phonePreviewColumn}
        </div>
      ) : (
        <div className="max-w-md space-y-3">
          {templatePickerBlock}
          <div className={mapperRowGridClass}>
            <Label
              htmlFor="lead-mapper-web-id-fallback"
              className="font-mono text-xs font-medium leading-tight text-foreground"
            >
              web_id
            </Label>
            <span className="text-muted-foreground" aria-hidden>
              →
            </span>
            <Select
              value={webId || undefined}
              onValueChange={(value) => {
                setWebId(value);
                userEditedRef.current = false;
              }}
              disabled={disabled || noWebIds || isLoading}
            >
              <SelectTrigger id="lead-mapper-web-id-fallback" className={mapperSelectTriggerClass}>
                <SelectValue
                  placeholder={t("omnichannel.settings.apiIntegration.leadMapper.webIdPlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {webIds.map((id) => (
                  <SelectItem key={id} value={id} className="font-mono text-sm">
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {noWebIds ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              {t("omnichannel.settings.apiIntegration.leadMapper.noWebIds")}
            </p>
          ) : null}
          {!templatesLoading && bodySlotCount === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("omnichannel.settings.apiIntegration.leadMapper.noBodySlots")}
            </p>
          ) : isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
