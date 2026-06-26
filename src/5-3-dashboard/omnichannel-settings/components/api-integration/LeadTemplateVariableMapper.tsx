import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
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
  useLeadTemplateMapping,
  useRecentLeadFormDataKeys,
  useSuggestLeadTemplateMapping,
} from "@/5-3-dashboard/omnichannel-settings/hooks/useOmnichannelApiIntegration";
import { WhatsAppTemplatePhonePreview } from "@/5-3-whatsapp-template/components/WhatsAppTemplatePhonePreview";

function rowLanguageCode(languageCode: string): string {
  return languageCode === "—" ? "id" : languageCode;
}

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
  onCompleteChange?: (complete: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  selectedWebId?: string | null;
  whatsappAccountId?: string | null;
  mappedAccountLabel?: string | null;
};

export function LeadTemplateVariableMapper({
  organizationId,
  template,
  onTemplateChange,
  leadMappingComplete = false,
  disabled = false,
  queryEnabled = true,
  onMappingChange,
  onCompleteChange,
  onDirtyChange,
  selectedWebId,
  whatsappAccountId,
  mappedAccountLabel,
}: LeadTemplateVariableMapperProps) {
  const { t } = useTranslation();
  const webId = selectedWebId?.trim() ?? "";
  const [slotMapping, setSlotMapping] = useState<Record<number, string>>({});
  const [loadedBaseline, setLoadedBaseline] = useState<Record<number, string>>({});
  const [suggestLoadedKey, setSuggestLoadedKey] = useState("");
  const userEditedRef = useRef(false);
  const stableBodySlotCountRef = useRef(0);
  const prevWebIdRef = useRef(webId);

  const templateName = template?.name.trim() ?? "";
  const templateLanguage = (template?.language ?? "id").trim() || "id";

  const {
    rows,
    isLoading: templatesInitialLoading,
    isRefetching: templatesRefetching,
  } = useApprovedWhatsAppTemplatesFlat({
    enabled: queryEnabled,
    whatsappAccountId,
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
  if (bodySlotCount > 0) {
    stableBodySlotCountRef.current = bodySlotCount;
  }
  const displaySlotCount =
    bodySlotCount > 0 ? bodySlotCount : stableBodySlotCountRef.current;

  const {
    data: savedMapping,
    isLoading: mappingLoading,
    isFetching: mappingFetching,
  } = useLeadTemplateMapping(
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
    () => isLeadMappingComplete(slotMapping, displaySlotCount),
    [slotMapping, displaySlotCount],
  );

  const isMappingDirty = useMemo(() => {
    if (!mappingComplete || !webId) return false;
    for (let slot = 1; slot <= displaySlotCount; slot++) {
      if ((slotMapping[slot] ?? "").trim() !== (loadedBaseline[slot] ?? "").trim()) {
        return true;
      }
    }
    return false;
  }, [slotMapping, loadedBaseline, mappingComplete, displaySlotCount, webId]);

  const applyLoadedMapping = useCallback((mapping: Record<number, string>) => {
    setSlotMapping((prev) =>
      slotMappingsEqual(prev, mapping, displaySlotCount) ? prev : mapping,
    );
    setLoadedBaseline((prev) =>
      slotMappingsEqual(prev, mapping, displaySlotCount) ? prev : mapping,
    );
    userEditedRef.current = false;
  }, [displaySlotCount]);

  const slotMappingRef = useRef(slotMapping);
  slotMappingRef.current = slotMapping;

  useEffect(() => {
    if (prevWebIdRef.current !== webId) {
      prevWebIdRef.current = webId;
      userEditedRef.current = false;
      setSuggestLoadedKey("");
    }
  }, [webId]);

  useEffect(() => {
    userEditedRef.current = false;
    setSuggestLoadedKey("");
  }, [organizationId, templateName, templateLanguage]);

  const mappingLoadKey = `${webId}::${templateName}::${templateLanguage}`;
  const savedMappingMatchesWebId = savedMapping?.web_id === webId;

  useEffect(() => {
    if (!webId || !templateName) return;

    if (savedMappingMatchesWebId && savedMapping?.parameter_mapping) {
      const fromDb = parameterMappingToRecord(savedMapping.parameter_mapping);
      if (Object.keys(fromDb).length > 0) {
        if (
          !userEditedRef.current &&
          !slotMappingsEqual(fromDb, slotMappingRef.current, displaySlotCount)
        ) {
          applyLoadedMapping(fromDb);
        }
        return;
      }
    }

    if (!savedMappingMatchesWebId && mappingFetching) return;

    if (userEditedRef.current) return;

    if (displaySlotCount <= 0 || suggestLoadedKey === mappingLoadKey || suggestMapping.isPending) {
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
    savedMappingMatchesWebId,
    displaySlotCount,
    webId,
    templateName,
    templateLanguage,
    mappingLoadKey,
    suggestLoadedKey,
    suggestMapping,
    applyLoadedMapping,
    mappingFetching,
  ]);

  useEffect(() => {
    onCompleteChange?.(mappingComplete && Boolean(webId));
  }, [mappingComplete, webId, onCompleteChange]);

  useEffect(() => {
    onDirtyChange?.(isMappingDirty);
  }, [isMappingDirty, onDirtyChange]);

  useEffect(() => {
    if (!mappingComplete || !webId) {
      onMappingChange?.(null);
      return;
    }
    onMappingChange?.(recordToParameterMapping(slotMapping));
  }, [slotMapping, mappingComplete, webId, onMappingChange]);

  const bodySlots = useMemo(() => {
    if (displaySlotCount <= 0) return [];
    return Array.from({ length: displaySlotCount }, (_, i) => i + 1);
  }, [displaySlotCount]);

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
    if (!matchedTemplate || !mappingComplete || displaySlotCount <= 0) return null;

    const bodyText = buildLeadTemplateBodyPreviewText(
      matchedTemplate.bodyFull,
      slotMapping,
      displaySlotCount,
      previewSubmission,
    );

    return {
      bodyText,
      submittedAt: previewSubmission?.submitted_at ?? null,
    };
  }, [matchedTemplate, mappingComplete, displaySlotCount, slotMapping, previewSubmission]);

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

  const slotsBusy =
    templatesInitialLoading ||
    templatesRefetching ||
    mappingLoading ||
    mappingFetching;
  const previewLoading = submissionLoading || submissionFetching;

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
        whatsappAccountId={whatsappAccountId}
      />
    </div>
  );

  const webIdContextBlock = webId ? (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">
        {t("omnichannel.settings.apiIntegration.leadMapper.contextWebId")}
      </span>
      <Badge variant="outline" className="font-mono text-[11px] font-normal">
        {webId}
      </Badge>
      {mappedAccountLabel ? (
        <span className="text-muted-foreground">{mappedAccountLabel}</span>
      ) : null}
    </div>
  ) : (
    <p className="text-xs text-amber-800 dark:text-amber-200">
      {t("omnichannel.settings.apiIntegration.leadMapper.selectWebIdAbove")}
    </p>
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

  if (!templateName) {
    return (
      <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-4">
        <div className="mb-3">
          <h5 className="text-sm font-semibold text-foreground">
            {t("omnichannel.settings.apiIntegration.leadMapper.title")}
          </h5>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("omnichannel.settings.apiIntegration.leadMapper.subtitle")}
          </p>
        </div>
        <div className="max-w-md">{templatePickerBlock}</div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="mb-3">
        <h5 className="text-sm font-semibold text-foreground">
          {t("omnichannel.settings.apiIntegration.leadMapper.title")}
        </h5>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("omnichannel.settings.apiIntegration.leadMapper.subtitle")}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:gap-12 lg:overflow-hidden">
        <div className="w-full max-w-md shrink-0 space-y-3">
          {templatePickerBlock}
          {webIdContextBlock}

          {webId && displaySlotCount > 0 ? (
            <div
              className={`relative space-y-3 ${slotsBusy ? "pointer-events-none opacity-60" : ""}`}
              style={{ minHeight: displaySlotCount > 0 ? `${displaySlotCount * 2.75 + 1}rem` : undefined }}
            >
              {slotsBusy ? (
                <div className="absolute right-0 top-0 z-10 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  <span className="sr-only">{t("common.loading")}</span>
                </div>
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
                      disabled={disabled || slotsBusy}
                    >
                      <SelectTrigger className={mapperSelectTriggerClass}>
                        <SelectValue
                          placeholder={t(
                            "omnichannel.settings.apiIntegration.leadMapper.fieldPlaceholder",
                          )}
                        />
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
                          <SelectLabel>
                            {t("omnichannel.settings.apiIntegration.leadMapper.group.core")}
                          </SelectLabel>
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
                            <SelectLabel>
                              {t("omnichannel.settings.apiIntegration.leadMapper.group.formCommon")}
                            </SelectLabel>
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
                            <SelectLabel>
                              {t("omnichannel.settings.apiIntegration.leadMapper.group.custom")}
                            </SelectLabel>
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
                  {t("omnichannel.settings.apiIntegration.leadMapper.incomplete", {
                    count: displaySlotCount,
                  })}
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
          ) : webId && !templatesRefetching && displaySlotCount === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("omnichannel.settings.apiIntegration.leadMapper.noBodySlots")}
            </p>
          ) : null}
        </div>

        {phonePreviewColumn}
      </div>
    </div>
  );
}
