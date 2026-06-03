import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { format, parseISO } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { HeaderAndTab } from "@/5-3-dashboard/components/layout/HeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useWhatsAppAccounts } from "@/5-3-whatsapp/hooks/useWhatsAppAccounts";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { CampaignContentSection } from "@/5-3-whatsapp-template/components/campaign/CampaignContentSection";
import { CampaignErrorMessage } from "@/5-3-whatsapp-template/components/campaign/CampaignErrorMessage";
import { CampaignDetailPanel } from "@/5-3-whatsapp-template/components/CampaignDetailPanel";
import { WhatsAppTemplatePhonePreview } from "@/5-3-whatsapp-template/components/WhatsAppTemplatePhonePreview";
import {
  useActiveOrgOwnerRpc,
  useWhatsappRecipientListDetail,
  useWhatsappRecipientLists,
} from "@/5-3-whatsapp-template/hooks/useWhatsappRecipientLists";
import { useWhatsAppMessageTemplateByHsmId } from "@/5-3-whatsapp-template/hooks/useWhatsAppMessageTemplateByHsmId";
import { useWhatsAppMessageTemplates } from "@/5-3-whatsapp-template/hooks/useWhatsAppMessageTemplates";
import { useCreateWhatsAppCampaign, useWhatsAppCampaignsList } from "@/5-3-whatsapp-template/hooks/useWhatsAppCampaign";
import { mapMetaTemplateToRow } from "@/5-3-whatsapp-template/utils/mapMetaTemplateToRow";
import { splitFlatParametersForPreview } from "@/5-3-whatsapp-template/utils/buildCampaignTemplateParameters";
import {
  buildParameterValuesFromMapping,
  extractTemplateParameterSlots,
  getListCreationSource,
  isMappingComplete,
  mergeMappingOnListChange,
  suggestDefaultMapping,
  type VariableMapping,
  variableMappingToJson,
} from "@/5-3-whatsapp-template/utils/campaignTemplateContent";
import { wibLocalStringToUtcIso } from "@/5-3-whatsapp-template/utils/wibLocalSchedule";
import type { MetaMessageTemplate, TemplateTableRow } from "@/5-3-whatsapp-template/types";

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "completed") return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80";
  if (s === "failed" || s === "cancelled") return "bg-red-100 text-red-900 ring-1 ring-red-200/80";
  if (s === "running" || s === "queued") return "bg-sky-100 text-sky-900 ring-1 ring-sky-200/80";
  if (s === "scheduled") return "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80";
  if (s === "draft") return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80";
  return "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80";
}

/**
 * `/omnichannel/campaign/whatsapp` — campaign list + create flow;
 * Page access: `/omnichannel/campaign/whatsapp` (inherits `/omnichannel` when configured).
 */
export function WhatsAppCampaignPage() {
  const { t, i18n } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const { data: ownerOk, isLoading: ownerLoading } = useActiveOrgOwnerRpc(organizationId);
  const { accounts: waAccounts, isLoading: waAccountsLoading } = useWhatsAppAccounts();
  const { data: listRows = [], isLoading: listsLoading } = useWhatsappRecipientLists(organizationId);

  const [viewMode, setViewMode] = useState<"list" | "create">("list");
  const [waAccountId, setWaAccountId] = useState<string>("");
  const [listId, setListId] = useState<string>("");
  const [templateHsmId, setTemplateHsmId] = useState<string>("");
  const [campaignName, setCampaignName] = useState("");
  const [sendMode, setSendMode] = useState<"now" | "later">("now");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [detailCampaignId, setDetailCampaignId] = useState<string | null>(null);
  const [variableMapping, setVariableMapping] = useState<VariableMapping>({});
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const prevListIdRef = useRef<string>("");
  const prevTemplateHsmIdRef = useRef<string>("");
  const prevSlotCountRef = useRef(0);

  const listQueryEnabled = Boolean(organizationId) && ownerOk === true;
  const { data: campaigns = [], isLoading: campaignsLoading } = useWhatsAppCampaignsList(organizationId, listQueryEnabled);

  const createFlow = viewMode === "create";
  const waForTemplates = createFlow ? waAccountId || null : null;
  const { data: listDetail, isLoading: listDetailLoading } = useWhatsappRecipientListDetail(
    organizationId,
    createFlow && listId ? listId : undefined,
  );
  const tplQuery = useWhatsAppMessageTemplates(waForTemplates);
  const templateDetail = useWhatsAppMessageTemplateByHsmId({
    hsmId: createFlow && templateHsmId ? templateHsmId : null,
    whatsappAccountId: waForTemplates,
  });
  const createCampaign = useCreateWhatsAppCampaign();

  const resetCampaignForm = useCallback(() => {
    setCampaignName("");
    setListId("");
    setTemplateHsmId("");
    setSendMode("now");
    setScheduledLocal("");
    setVariableMapping({});
    prevListIdRef.current = "";
    prevTemplateHsmIdRef.current = "";
    prevSlotCountRef.current = 0;
  }, []);

  useEffect(() => {
    setTemplateHsmId("");
  }, [waAccountId]);

  useEffect(() => {
    if (viewMode === "create") setDetailCampaignId(null);
  }, [viewMode]);

  useEffect(() => {
    if (!detailCampaignId) return;
    const id = requestAnimationFrame(() => {
      detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => cancelAnimationFrame(id);
  }, [detailCampaignId]);

  useEffect(() => {
    if (!organizationId) {
      setWaAccountId("");
      return;
    }
    if (waAccounts.length === 0) {
      setWaAccountId("");
      return;
    }
    setWaAccountId((prev) => (prev && waAccounts.some((a) => a.id === prev) ? prev : waAccounts[0]!.id));
  }, [organizationId, waAccounts]);

  const templateRows: TemplateTableRow[] = useMemo(() => {
    const pages = tplQuery.data?.pages ?? [];
    const metas = pages.flatMap((p) => p.data ?? []) as MetaMessageTemplate[];
    return metas.map((m) => mapMetaTemplateToRow(m)).filter((x): x is TemplateTableRow => Boolean(x));
  }, [tplQuery.data?.pages]);

  const approvedTemplates = useMemo(
    () => templateRows.filter((row) => row.statusRaw === "APPROVED"),
    [templateRows],
  );

  const selectedMeta = templateDetail.data?.data?.[0] as MetaMessageTemplate | undefined;
  const previewRow = useMemo(() => (selectedMeta ? mapMetaTemplateToRow(selectedMeta) : null), [selectedMeta]);
  const componentsJson = useMemo(() => {
    const c = selectedMeta?.components;
    return Array.isArray(c) ? c : [];
  }, [selectedMeta?.components]);

  const templateSlots = useMemo(
    () => extractTemplateParameterSlots(componentsJson),
    [componentsJson],
  );

  const listCreationSource = getListCreationSource(listDetail);

  useEffect(() => {
    if (!createFlow) return;

    const tplChanged = templateHsmId !== prevTemplateHsmIdRef.current;
    const listChanged = listId !== prevListIdRef.current;
    const slotCount = templateSlots.length;
    const slotsBecameReady =
      slotCount > 0 && prevSlotCountRef.current === 0 && Boolean(templateHsmId && listId);

    prevTemplateHsmIdRef.current = templateHsmId;
    prevListIdRef.current = listId;
    prevSlotCountRef.current = slotCount;

    if (!templateHsmId || !listId) {
      if (tplChanged || listChanged) setVariableMapping({});
      return;
    }
    if (slotCount === 0) return;

    if (tplChanged) {
      setVariableMapping(suggestDefaultMapping(templateSlots, listCreationSource));
      return;
    }
    if (listChanged) {
      setVariableMapping((prev) =>
        mergeMappingOnListChange(prev, templateSlots, listCreationSource),
      );
      return;
    }
    if (slotsBecameReady) {
      setVariableMapping((prev) => {
        if (isMappingComplete(templateSlots, prev)) return prev;
        return suggestDefaultMapping(templateSlots, listCreationSource);
      });
    }
  }, [createFlow, templateHsmId, listId, templateSlots, listCreationSource]);

  const mappingComplete = useMemo(
    () => isMappingComplete(templateSlots, variableMapping),
    [templateSlots, variableMapping],
  );

  const previewSamples = useMemo(() => {
    if (!previewRow || !listDetail?.members?.length || !listDetail.rawMembers?.length || !componentsJson.length) {
      return null;
    }
    if (templateSlots.length > 0 && !mappingComplete) return null;
    const view = listDetail.members[0]!;
    const raw = listDetail.rawMembers[0]!;
    const flat =
      templateSlots.length > 0
        ? buildParameterValuesFromMapping(templateSlots, variableMapping, view, raw)
        : [];
    return splitFlatParametersForPreview(componentsJson, flat);
  }, [
    previewRow,
    listDetail?.members,
    listDetail?.rawMembers,
    componentsJson,
    templateSlots,
    variableMapping,
    mappingComplete,
  ]);

  const eligibleLists = useMemo(
    () => listRows.filter((r) => r.upload_status === "completed" && r.contact_count > 0),
    [listRows],
  );

  const listNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of listRows) m.set(r.id, r.name);
    return m;
  }, [listRows]);

  const dateLocale = i18n.language?.startsWith("en") ? enUS : idLocale;
  const formatDt = useCallback(
    (iso: string | null | undefined) => {
      if (!iso) return "—";
      try {
        return format(parseISO(iso), "dd MMM yyyy, HH:mm", { locale: dateLocale });
      } catch {
        return "—";
      }
    },
    [dateLocale],
  );

  const canSubmit =
    Boolean(ownerOk) &&
    campaignName.trim().length > 0 &&
    waAccountId &&
    listId &&
    templateHsmId &&
    listDetail?.memberTotal &&
    mappingComplete &&
    !templateDetail.isFetching &&
    !createCampaign.isPending;

  const onSubmit = async () => {
    if (!ownerOk) return;
    if (!listId || !listDetail?.members?.length) {
      toast.error(t("whatsappTemplates.campaign.toast.needList"));
      return;
    }
    if (!templateHsmId || !selectedMeta?.name || !selectedMeta?.language) {
      toast.error(t("whatsappTemplates.campaign.toast.needTemplate"));
      return;
    }
    if (!mappingComplete) {
      toast.error(t("whatsappTemplates.campaign.toast.needMapping"));
      return;
    }
    if (sendMode === "later") {
      const iso = wibLocalStringToUtcIso(scheduledLocal);
      if (!iso) {
        toast.error(t("whatsappTemplates.campaign.toast.needSchedule"));
        return;
      }
      const now = Date.now();
      if (new Date(iso).getTime() < now - 60_000) {
        toast.error(t("whatsappTemplates.campaign.toast.needSchedule"));
        return;
      }
    }

    const scheduledAtUtcIso = sendMode === "later" ? wibLocalStringToUtcIso(scheduledLocal) : null;

    try {
      await createCampaign.mutateAsync({
        name: campaignName.trim(),
        whatsappAccountId: waAccountId,
        recipientListId: listId,
        templateName: String(selectedMeta.name),
        templateLanguage: String(selectedMeta.language),
        templateHsmId: templateHsmId,
        templateComponentsJson: componentsJson,
        templateSlots,
        variableMapping,
        parameterMappingJson: variableMappingToJson(variableMapping),
        members: listDetail.members,
        rawMembers: listDetail.rawMembers,
        sendMode: sendMode === "later" ? "later" : "now",
        scheduledAtUtcIso,
      });
      resetCampaignForm();
      setViewMode("list");
      if (sendMode === "later") {
        toast.success(t("whatsappTemplates.campaign.toast.successTitle"), {
          description: t("whatsappTemplates.campaign.toast.successScheduled"),
        });
      } else {
        toast.success(t("whatsappTemplates.campaign.toast.successTitle"), {
          description: t("whatsappTemplates.campaign.toast.successSent"),
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t("whatsappTemplates.campaign.toast.errorTitle"), {
        description: msg,
        duration: 12_000,
        classNames: {
          description: "whitespace-pre-wrap break-all text-left",
        },
      });
    }
  };

  const ownerBlocked = !ownerLoading && ownerOk === false;

  const ownerBanner = (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
      <p className="font-medium">{t("whatsappTemplates.campaign.ownerOnly.title")}</p>
      <p className="mt-1 text-amber-800/90">{t("whatsappTemplates.campaign.ownerOnly.body")}</p>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-1 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>
              <ModuleShellContentGate pagePath="/omnichannel/campaign/whatsapp">
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                {viewMode === "list" ? (
                  <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      {detailCampaignId ? (
                        <div ref={detailPanelRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
                          <CampaignDetailPanel
                            campaignId={detailCampaignId}
                            onClose={() => setDetailCampaignId(null)}
                            listNameById={listNameById}
                            waAccounts={waAccounts}
                            formatDt={formatDt}
                            className="flex min-h-0 flex-1 max-h-[min(calc(100vh-180px),900px)]"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h1 className="text-lg font-semibold text-slate-900">{t("whatsappTemplates.campaign.pageTitle")}</h1>
                            </div>
                            {ownerOk && !ownerLoading ? (
                              <Button
                                type="button"
                                className="shrink-0"
                                onClick={() => {
                                  resetCampaignForm();
                                  setViewMode("create");
                                }}
                              >
                                {t("whatsappTemplates.campaign.createCampaign")}
                              </Button>
                            ) : null}
                          </div>

                          {ownerLoading ? (
                            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              <span>{t("whatsappTemplates.campaign.table.loading")}</span>
                            </div>
                          ) : ownerBlocked ? (
                            <div className="mt-6">{ownerBanner}</div>
                          ) : campaignsLoading ? (
                            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              <span>{t("whatsappTemplates.campaign.table.loading")}</span>
                            </div>
                          ) : campaigns.length === 0 ? (
                            <p className="mt-4 text-sm text-muted-foreground">{t("whatsappTemplates.campaign.table.empty")}</p>
                          ) : (
                            <div className="mt-3 min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto rounded-md border border-slate-200">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="whitespace-nowrap text-xs font-medium">
                                      {t("whatsappTemplates.campaign.col.name")}
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap text-xs font-medium">
                                      {t("whatsappTemplates.campaign.col.template")}
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap text-xs font-medium">
                                      {t("whatsappTemplates.campaign.col.list")}
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap text-xs font-medium">
                                      {t("whatsappTemplates.campaign.col.status")}
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap text-right text-xs font-medium">
                                      {t("whatsappTemplates.campaign.col.sent")}
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap text-right text-xs font-medium">
                                      {t("whatsappTemplates.campaign.col.read")}
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap text-right text-xs font-medium">
                                      {t("whatsappTemplates.campaign.col.failed")}
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap text-xs font-medium">
                                      {t("whatsappTemplates.campaign.col.scheduled")}
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap text-xs font-medium">
                                      {t("whatsappTemplates.campaign.col.created")}
                                    </TableHead>
                                    <TableHead className="min-w-[14rem] text-xs font-medium">
                                      {t("whatsappTemplates.campaign.col.error")}
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap text-right text-xs font-medium">
                                      {t("whatsappTemplates.campaign.col.action")}
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {campaigns.map((c) => (
                                    <TableRow key={c.id}>
                                      <TableCell className="max-w-[12rem] truncate font-medium text-slate-900" title={c.name}>
                                        {c.name}
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap text-sm text-slate-700">
                                        {c.template_name}
                                        <span className="text-muted-foreground"> · {c.template_language}</span>
                                      </TableCell>
                                      <TableCell
                                        className="max-w-[10rem] truncate text-sm text-slate-700"
                                        title={listNameById.get(c.recipient_list_id) ?? c.recipient_list_id}
                                      >
                                        {listNameById.get(c.recipient_list_id) ?? c.recipient_list_id.slice(0, 8) + "…"}
                                      </TableCell>
                                      <TableCell>
                                        <span
                                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(c.status)}`}
                                        >
                                          {c.status}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums text-sm">{c.sent_count}</TableCell>
                                      <TableCell className="text-right tabular-nums text-sm">{c.read_count ?? 0}</TableCell>
                                      <TableCell className="text-right tabular-nums text-sm">{c.failed_count}</TableCell>
                                      <TableCell className="whitespace-nowrap text-sm text-slate-600">
                                        {formatDt(c.scheduled_at)}
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap text-sm text-slate-600">
                                        {formatDt(c.created_at)}
                                      </TableCell>
                                      <TableCell className="min-w-[14rem] max-w-[min(32rem,50vw)] align-top py-2">
                                        {c.last_error ? (
                                          <CampaignErrorMessage message={c.last_error} compact className="w-full" />
                                        ) : (
                                          <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button
                                          type="button"
                                          variant="link"
                                          className="h-auto p-0 text-xs font-medium text-primary"
                                          onClick={() => setDetailCampaignId(c.id)}
                                        >
                                          {t("whatsappTemplates.campaign.viewDetail")}
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="col-span-12 flex min-h-0 min-w-0 flex-col xl:col-span-7">
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mb-3 -ml-2 w-fit gap-1 text-muted-foreground hover:text-slate-900"
                          onClick={() => {
                            resetCampaignForm();
                            setViewMode("list");
                          }}
                        >
                          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                          {t("whatsappTemplates.campaign.backToList")}
                        </Button>

                        <h1 className="text-lg font-semibold text-slate-900">{t("whatsappTemplates.campaign.pageTitle")}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{t("whatsappTemplates.campaign.pageIntro")}</p>
                        <p className="mt-2 text-xs">
                          <a
                            className="font-medium text-primary underline"
                            href="https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t("whatsappTemplates.campaign.metaLinkShort")}
                          </a>
                        </p>

                        {ownerLoading ? (
                          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            <span className="sr-only">Loading</span>
                          </div>
                        ) : ownerBlocked ? (
                          <div className="mt-6">{ownerBanner}</div>
                        ) : (
                          <div className="mt-6 min-w-0 space-y-5 overflow-x-hidden">
                            <div className="space-y-2">
                              <Label htmlFor="camp-name">{t("whatsappTemplates.campaign.field.campaignName")}</Label>
                              <Input
                                id="camp-name"
                                value={campaignName}
                                onChange={(e) => setCampaignName(e.target.value)}
                                maxLength={200}
                                placeholder="Q2 Promo"
                                autoComplete="off"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>{t("whatsappTemplates.campaign.field.sender")}</Label>
                              <Select
                                value={waAccountId || undefined}
                                onValueChange={setWaAccountId}
                                disabled={waAccountsLoading || waAccounts.length === 0}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t("whatsappTemplates.campaign.noAccounts")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {waAccounts.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>
                                      {a.whatsapp_business_name?.trim() ||
                                        a.display_phone_number?.trim() ||
                                        a.phone_number_id.slice(0, 12)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>{t("whatsappTemplates.campaign.field.recipientList")}</Label>
                              <Select value={listId || undefined} onValueChange={setListId} disabled={listsLoading}>
                                <SelectTrigger>
                                  <SelectValue placeholder={t("whatsappTemplates.campaign.listEmpty")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {eligibleLists.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>
                                      {r.name} ({r.contact_count})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {listId && !listDetailLoading ? (
                                <p className="text-xs text-muted-foreground">
                                  {t("whatsappTemplates.campaign.listContactCount", {
                                    count: listDetail?.memberTotal ?? 0,
                                  })}
                                </p>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                              <Label>{t("whatsappTemplates.campaign.field.template")}</Label>
                              <Select
                                value={templateHsmId || undefined}
                                onValueChange={setTemplateHsmId}
                                disabled={!waAccountId || tplQuery.isLoading}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent className="max-h-72">
                                  {approvedTemplates.map((row) => (
                                    <SelectItem key={row.id} value={row.id}>
                                      {row.templateName} · {row.languageLabel}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <CampaignContentSection
                              previewRow={previewRow}
                              componentsJson={componentsJson}
                              listDetail={listDetail ?? undefined}
                              listId={listId}
                              templateHsmId={templateHsmId}
                              variableMapping={variableMapping}
                              onMappingChange={setVariableMapping}
                              templateLoading={templateDetail.isFetching}
                              listLoading={listDetailLoading}
                            />

                            <div className="space-y-3">
                              <Label>{t("whatsappTemplates.campaign.sendMode")}</Label>
                              <RadioGroup
                                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6"
                                value={sendMode}
                                onValueChange={(v) => setSendMode(v as "now" | "later")}
                              >
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                  <RadioGroupItem value="now" id="sm-now" />
                                  <span>{t("whatsappTemplates.campaign.sendNow")}</span>
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                  <RadioGroupItem value="later" id="sm-later" />
                                  <span>{t("whatsappTemplates.campaign.sendLater")}</span>
                                </label>
                              </RadioGroup>
                              {sendMode === "later" ? (
                                <div className="space-y-2">
                                  <Label htmlFor="sched">{t("whatsappTemplates.campaign.scheduledAt")}</Label>
                                  <Input
                                    id="sched"
                                    type="datetime-local"
                                    step={60}
                                    value={scheduledLocal}
                                    onChange={(e) => setScheduledLocal(e.target.value)}
                                  />
                                  <p className="text-xs text-muted-foreground">{t("whatsappTemplates.campaign.scheduledHint")}</p>
                                </div>
                              ) : null}
                            </div>

                            <Button type="button" className="w-full sm:w-auto" disabled={!canSubmit} onClick={() => void onSubmit()}>
                              {createCampaign.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                                  {t("whatsappTemplates.campaign.submitting")}
                                </>
                              ) : (
                                t("whatsappTemplates.campaign.submit")
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="col-span-12 flex min-h-0 min-w-0 flex-col xl:col-span-5">
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <p className="text-sm font-medium text-slate-800">{t("whatsappTemplates.campaign.previewTitle")}</p>
                        {previewRow ? (
                          <div className="mt-4 min-h-0 flex-1 overflow-auto">
                            <WhatsAppTemplatePhonePreview
                              className="pb-2"
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
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-muted-foreground">—</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              </ModuleShellContentGate>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
