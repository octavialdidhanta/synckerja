import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Maximize2, RefreshCw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/components/ui/accordion";
import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { supabase } from "@/shared/lib/supabaseClient";
import { readEdgeFunctionError } from "@/shared/ai/geminiSpendCap";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatUsageCostDetail, mergeUsageCostLines, usageCostIdr, usageCostLines } from "@/6-1-dashboard/lib/usagePrice";

type UsageService = "voice" | "video" | "image" | "script";
type UsageStatus = "queued" | "running" | "succeeded" | "failed";

type UsageRow = {
  id: string;
  service: UsageService;
  action: string;
  target_label: string | null;
  model: string | null;
  usage_amount: number | null;
  usage_unit: "character" | "token" | null;
  input_tokens: number | null;
  output_tokens: number | null;
  status: UsageStatus;
  actor_user_id: string | null;
  created_at: string;
  actor_name: string | null;
};

const SERVICES: UsageService[] = ["voice", "video", "image", "script"];
const summaryColumns = "minmax(4.5rem,0.7fr) minmax(7rem,1.1fr) 5rem 5rem 6.5rem 4rem 6.5rem";

function RupiahAmount({ value, detail }: { value: string; detail: string }) {
  if (!detail) return <span className="tabular-nums">{value}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help tabular-nums underline decoration-dotted decoration-gray-300 underline-offset-2">{value}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm text-left text-xs font-normal leading-snug">
        {detail}
      </TooltipContent>
    </Tooltip>
  );
}

export function ContentUsageAudit({
  planId,
  masterThoughtId,
  expanded = false,
  hidden = false,
  onExpand,
  onCollapse,
}: {
  planId?: string;
  masterThoughtId?: string;
  expanded?: boolean;
  hidden?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
}) {
  const { t } = useAppTranslation();
  const [syncing, setSyncing] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<"all" | UsageService>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "succeeded" | "failed">("all");
  const textAudit = Boolean(masterThoughtId);
  const query = useQuery({
    queryKey: textAudit ? ["content-ai-usage", "master", masterThoughtId] : ["content-ai-usage", planId],
    enabled: textAudit ? Boolean(masterThoughtId) : Boolean(planId),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_ai_usage")
        .select("id, service, action, target_label, model, usage_amount, usage_unit, input_tokens, output_tokens, status, actor_user_id, created_at")
        .eq(textAudit ? "thinking_master_thought_id" : "social_media_plan_id", (textAudit ? masterThoughtId : planId) as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Omit<UsageRow, "actor_name">[];
      const actorIds = [...new Set(rows.map((row) => row.actor_user_id).filter((id): id is string => Boolean(id)))];
      const names = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: people, error: peopleError } = await supabase.from("employees").select("user_id, full_name").in("user_id", actorIds);
        if (!peopleError) {
          for (const person of (people ?? []) as Array<{ user_id: string | null; full_name: string | null }>) {
            if (person.user_id && person.full_name) names.set(person.user_id, person.full_name);
          }
        }
      }
      return rows.map((row) => ({ ...row, actor_name: row.actor_user_id ? names.get(row.actor_user_id) ?? null : null }));
    },
  });
  const rows = query.data ?? [];
  const filteredRows = rows.filter((row) => {
    if (serviceFilter !== "all" && row.service !== serviceFilter) return false;
    if (statusFilter === "succeeded" && row.status !== "succeeded") return false;
    if (statusFilter === "failed" && row.status !== "failed") return false;
    return true;
  });
  const formatAmount = (value: number) => value.toLocaleString("id-ID");
  const formatIdr = (value: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
  const costInput = (row: UsageRow) => ({
    model: row.model,
    amount: row.usage_amount,
    unit: row.usage_unit,
    targetLabel: row.target_label,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
  });
  const rowLines = (row: UsageRow) => usageCostLines(costInput(row));
  const serviceLabel = (service: string) =>
    textAudit && service === "script" ? t("briefDialog.usage.service.text", "Text") : t(`briefDialog.usage.service.${service}`, service);
  const actionLabel = (action: string) => t(`briefDialog.usage.action.${action}`, action);
  const statusLabel = (status: string) => t(`briefDialog.usage.status.${status}`, status);
  const unitLabel = (unit: string | null) => (unit ? t(`briefDialog.usage.unit.${unit}`, unit) : "");
  const filterSelectClass =
    "h-7 max-w-[9.5rem] rounded-md border border-gray-200 bg-white px-2 text-[11px] font-normal text-gray-700 outline-none focus:border-gray-300";
  const summary = SERVICES.flatMap((service) => {
    const items = filteredRows.filter((row) => row.service === service);
    if (items.length === 0) return [];
    const units = [...new Set(items.map((row) => row.usage_unit).filter((unit): unit is "character" | "token" => Boolean(unit)))];
    const totals = units.map((unit) => ({
      unit,
      amount: items.reduce((sum, row) => sum + (row.usage_unit === unit && row.usage_amount != null ? row.usage_amount : 0), 0),
    }));
    const models = [...new Set(items.map((row) => row.model?.trim()).filter((model): model is string => Boolean(model)))].sort((a, b) => a.localeCompare(b));
    const lineGroups = items.map((row) => rowLines(row));
    const idrValues = items.map((row) => usageCostIdr(costInput(row))).filter((value): value is number => value != null);
    return [{
      service,
      model: models.join(" · "),
      attempts: items.length,
      succeeded: items.filter((row) => row.status === "succeeded").length,
      totals,
      idr: idrValues.length === 0 ? null : idrValues.reduce((sum, value) => sum + value, 0),
      detail: formatUsageCostDetail(mergeUsageCostLines(lineGroups)),
    }];
  });
  const totalIdr = summary.reduce((sum, item) => sum + (item.idr ?? 0), 0);
  const presentServices = SERVICES.filter((service) => rows.some((row) => row.service === service));

  const refreshFromApi = async () => {
    if (textAudit) {
      if (!masterThoughtId || syncing) return;
      setSyncing(true);
      try {
        await query.refetch();
      } finally {
        setSyncing(false);
      }
      return;
    }
    if (!planId || syncing) return;
    setSyncing(true);
    try {
      const [voice, image, video] = await Promise.all([
        supabase.functions.invoke("generate-brief-voice", { body: { action: "sync", planId } }),
        supabase.functions.invoke("generate-design-image", { body: { action: "sync", planId } }),
        supabase.functions.invoke("generate-brief-video", { body: { action: "sync", planId } }),
      ]);
      const voiceMessage = await readEdgeFunctionError(voice.data, voice.error);
      const imageMessage = await readEdgeFunctionError(image.data, image.error);
      const videoMessage = await readEdgeFunctionError(video.data, video.error);
      if (voiceMessage && !voice.data?.ok) toast.error(voiceMessage);
      if (imageMessage && !image.data?.ok) toast.error(imageMessage);
      if (videoMessage && !video.data?.ok) toast.error(videoMessage);
      if ((voiceMessage && !voice.data?.ok) || (imageMessage && !image.data?.ok) || (videoMessage && !video.data?.ok)) return;
      toast.success(t("briefDialog.usage.refreshed", "{{added}} new rows. {{priced}} official amounts filled.", {
        added: Number(voice.data?.added ?? 0) + Number(image.data?.added ?? 0) + Number(video.data?.added ?? 0),
        priced: Number(voice.data?.priced ?? 0) + Number(image.data?.priced ?? 0) + Number(video.data?.priced ?? 0),
      }));
    } finally {
      await query.refetch();
      setSyncing(false);
    }
  };

  return (
    <AccordionItem
      value="usageAudit"
      className={`flex flex-col bg-white ${
        hidden
          ? "hidden"
          : expanded
            ? "min-h-0 flex-1 shrink border-0 px-0"
            : "flex-shrink-0 rounded-lg border border-gray-200 px-4 data-[state=open]:flex-1 data-[state=open]:min-h-0 data-[state=open]:overflow-hidden"
      }`}
    >
      <AccordionTrigger
        headerClassName={expanded ? "hidden" : undefined}
        className="flex-shrink-0 py-3 text-sm font-medium text-gray-800 hover:no-underline [&>svg]:ml-2"
        headerAccessory={
          expanded ? null : (
            <div className="ml-2 flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 shrink-0 p-0"
                disabled={(textAudit ? !masterThoughtId : !planId) || syncing}
                title={syncing ? t("briefDialog.usage.refreshing", "Refreshing") : t("briefDialog.usage.refresh", "Refresh")}
                aria-label={syncing ? t("briefDialog.usage.refreshing", "Refreshing") : t("briefDialog.usage.refresh", "Refresh")}
                onClick={() => void refreshFromApi()}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              </Button>
              {onExpand ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0"
                  title={t("briefDialog.workArea.expand", "Expand work area")}
                  aria-label={t("briefDialog.workArea.expand", "Expand work area")}
                  onClick={onExpand}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          )
        }
      >
        <span className="flex items-center gap-2">
          {rows.length > 0 ? (
            <CircleCheck className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
          ) : (
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300" aria-hidden />
          )}
          {t("briefDialog.sectionUsageAudit", "Usage audit")}
        </span>
      </AccordionTrigger>
      <AccordionContent
        primitiveClassName="flex min-h-0 flex-1 flex-col overflow-hidden !h-auto data-[state=open]:!animate-none data-[state=closed]:!animate-none"
        className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white pt-0 ${expanded ? "pb-0" : "pb-3"}`}
      >
        {expanded ? (
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={onCollapse}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("briefDialog.workArea.back", "Back")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              disabled={(textAudit ? !masterThoughtId : !planId) || syncing}
              title={syncing ? t("briefDialog.usage.refreshing", "Refreshing") : t("briefDialog.usage.refresh", "Refresh")}
              aria-label={syncing ? t("briefDialog.usage.refreshing", "Refreshing") : t("briefDialog.usage.refresh", "Refresh")}
              onClick={() => void refreshFromApi()}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        ) : null}
        {(textAudit ? masterThoughtId : planId) && rows.length > 0 ? (
          <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="usage-filter-service">{t("briefDialog.usage.colService", "Service")}</label>
            <select
              id="usage-filter-service"
              className={filterSelectClass}
              value={serviceFilter}
              onChange={(event) => setServiceFilter(event.target.value as "all" | UsageService)}
            >
              <option value="all">{t("briefDialog.usage.filterAllServices", "All services")}</option>
              {presentServices.map((service) => (
                <option key={service} value={service}>{serviceLabel(service)}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="usage-filter-status">{t("briefDialog.usage.colStatus", "Status")}</label>
            <select
              id="usage-filter-status"
              className={filterSelectClass}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "succeeded" | "failed")}
            >
              <option value="all">{t("briefDialog.usage.filterAllStatuses", "All statuses")}</option>
              <option value="succeeded">{statusLabel("succeeded")}</option>
              <option value="failed">{statusLabel("failed")}</option>
            </select>
          </div>
        ) : null}
        {!(textAudit ? masterThoughtId : planId) ? null : query.isPending ? (
          <p className="text-sm text-gray-500">{t("briefDialog.usage.loading", "Loading usage")}</p>
        ) : query.isError ? (
          <p className="text-sm text-red-600">{t("briefDialog.usage.error", "Usage could not be loaded.")}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">
            {textAudit
              ? t("briefDialog.usage.emptyMaster", "No recorded text usage for this Master Thought yet.")
              : t("briefDialog.usage.empty", "No recorded usage for this content yet.")}
          </p>
        ) : (
          <div className="scrollbar-hide seamless-scroll flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TooltipProvider delayDuration={200}>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
            {textAudit && masterThoughtId ? (
              <p className="shrink-0 truncate font-mono text-[11px] text-gray-400" title={masterThoughtId}>
                {t("briefDialog.usage.masterThoughtId", "Master Thought ID")} {masterThoughtId}
              </p>
            ) : null}
            <div key="usage-summary" className="scrollbar-hide seamless-scroll relative z-[1] shrink-0 overflow-x-auto bg-white [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="min-w-[720px] bg-white text-left text-xs">
                <div className="grid border-b border-gray-200 bg-gray-50 text-[11px] font-medium text-gray-500" style={{ gridTemplateColumns: summaryColumns }}>
                  <div className="px-2 py-1.5">{t("briefDialog.usage.colService", "Service")}</div>
                  <div className="px-2 py-1.5">{t("briefDialog.usage.colModel", "Model")}</div>
                  <div className="px-2 py-1.5 text-right">{t("briefDialog.usage.colAttempts", "Attempts")}</div>
                  <div className="px-2 py-1.5 text-right">{t("briefDialog.usage.colSucceeded", "Succeeded")}</div>
                  <div className="px-2 py-1.5 text-right">{t("briefDialog.usage.colTotal", "Recorded usage")}</div>
                  <div className="px-2 py-1.5">{t("briefDialog.usage.colUnit", "Unit")}</div>
                  <div className="px-2 py-1.5 text-right" title={t("briefDialog.usage.rupiahTitle", "List price converted at the JISDOR rate on 20 October 2026, Rp18,006 per US dollar.")}>{t("briefDialog.usage.colRupiah", "Rupiah")}</div>
                </div>
                {summary.map((item) => (
                  <div
                    key={item.service}
                    className="grid border-b border-gray-100 bg-white text-gray-800"
                    style={{ gridTemplateColumns: summaryColumns }}
                  >
                    <div className="px-2 py-1.5">{serviceLabel(item.service)}</div>
                    <div className="truncate px-2 py-1.5 text-gray-500" title={item.model}>{item.model}</div>
                    <div className="px-2 py-1.5 text-right tabular-nums">{item.attempts}</div>
                    <div className="px-2 py-1.5 text-right tabular-nums">{item.succeeded}</div>
                    <div className="px-2 py-1.5 text-right tabular-nums">
                      {item.totals.length === 0 ? "" : item.totals.map((total) => formatAmount(total.amount)).join(" · ")}
                    </div>
                    <div className="px-2 py-1.5 text-gray-500">
                      {item.totals.map((total) => unitLabel(total.unit)).join(" · ")}
                    </div>
                    <div className="px-2 py-1.5 text-right">
                      {item.idr == null ? "" : <RupiahAmount value={formatIdr(item.idr)} detail={item.detail} />}
                    </div>
                  </div>
                ))}
                <div
                  className="grid border-t border-gray-300 bg-gray-50 font-semibold text-gray-900"
                  style={{ gridTemplateColumns: summaryColumns }}
                >
                  <div className="col-span-6 px-2 py-1.5">{t("briefDialog.usage.totalCost", "Total")}</div>
                  <div className="px-2 py-1.5 text-right">
                    <RupiahAmount
                      value={formatIdr(totalIdr)}
                      detail={summary.filter((item) => item.idr != null).map((item) => `${serviceLabel(item.service)} ${formatIdr(item.idr ?? 0)}`).join(" + ")}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain relative z-0 min-h-0 flex-1 overflow-auto bg-white [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <table className="w-full min-w-[860px] border-collapse text-left text-xs">
                <thead className="sticky top-0 z-[1] bg-gray-50">
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-medium text-gray-500">
                    <th className="px-2 py-1.5 font-medium">{t("briefDialog.usage.colTime", "Time")}</th>
                    <th className="px-2 py-1.5 font-medium">{t("briefDialog.usage.colService", "Service")}</th>
                    <th className="px-2 py-1.5 font-medium">{t("briefDialog.usage.colAction", "Action")}</th>
                    <th className="px-2 py-1.5 font-medium">{t("briefDialog.usage.colTarget", "Target")}</th>
                    <th className="px-2 py-1.5 font-medium">{t("briefDialog.usage.colModel", "Model")}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{t("briefDialog.usage.colAmount", "Usage")}</th>
                    <th className="px-2 py-1.5 font-medium">{t("briefDialog.usage.colUnit", "Unit")}</th>
                    <th className="px-2 py-1.5 text-right font-medium" title={t("briefDialog.usage.rupiahTitle", "List price converted at the JISDOR rate on 20 October 2026, Rp18,006 per US dollar.")}>{t("briefDialog.usage.colRupiah", "Rupiah")}</th>
                    <th className="px-2 py-1.5 font-medium">{t("briefDialog.usage.colStatus", "Status")}</th>
                    <th className="px-2 py-1.5 font-medium">{t("briefDialog.usage.colActor", "By")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-2 py-4 text-center text-gray-500">
                        {t("briefDialog.usage.filterEmpty", "No rows match these filters.")}
                      </td>
                    </tr>
                  ) : filteredRows.map((row) => {
                    const lines = rowLines(row);
                    const idr = lines ? usageCostIdr(costInput(row)) : null;
                    const detail = lines ? formatUsageCostDetail(lines) : "";
                    return (
                    <tr key={row.id} className="border-b border-gray-100 text-gray-800">
                      <td className="whitespace-nowrap px-2 py-1.5 text-gray-500">
                        {new Date(row.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5">{serviceLabel(row.service)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{actionLabel(row.action)}</td>
                      <td className="max-w-[180px] truncate px-2 py-1.5" title={row.target_label ?? ""}>{row.target_label ?? ""}</td>
                      <td className="max-w-[140px] truncate px-2 py-1.5 text-gray-500" title={row.model ?? ""}>{row.model ?? ""}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{row.usage_amount == null ? "" : formatAmount(row.usage_amount)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-gray-500">{unitLabel(row.usage_unit)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right">{idr == null ? "" : <RupiahAmount value={formatIdr(idr)} detail={detail} />}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{statusLabel(row.status)}</td>
                      <td className="max-w-[140px] truncate px-2 py-1.5" title={row.actor_name ?? ""}>{row.actor_name ?? ""}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
            </TooltipProvider>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
