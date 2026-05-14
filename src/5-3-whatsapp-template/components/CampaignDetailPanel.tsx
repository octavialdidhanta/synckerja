import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import type { WhatsAppAccount } from "@/5-3-whatsapp/types";
import { Button } from "@/shared/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { cn } from "@/shared/lib/utils";
import {
  type WhatsAppCampaignRecipientRow,
  useWhatsAppCampaign,
  useWhatsAppCampaignRecipients,
} from "@/5-3-whatsapp-template/hooks/useWhatsAppCampaign";

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "completed") return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80";
  if (s === "failed" || s === "cancelled") return "bg-red-100 text-red-900 ring-1 ring-red-200/80";
  if (s === "running" || s === "queued") return "bg-sky-100 text-sky-900 ring-1 ring-sky-200/80";
  if (s === "scheduled") return "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80";
  if (s === "sent") return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80";
  if (s === "pending") return "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80";
  if (s === "skipped") return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/60";
  return "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80";
}

function senderLabel(accounts: WhatsAppAccount[], id: string): string {
  const a = accounts.find((x) => x.id === id);
  if (!a) return id.length > 10 ? `${id.slice(0, 8)}…` : id;
  return (
    a.whatsapp_business_name?.trim() ||
    a.display_phone_number?.trim() ||
    a.phone_number_id.slice(0, 14)
  );
}

function displayE164(e164: string): string {
  const d = String(e164 ?? "").replace(/\D/g, "");
  if (d.startsWith("62")) return `+${d}`;
  if (d.length > 0) return `+${d}`;
  return e164;
}

/** Meta webhook statuses after Graph accepted the template send (`send_status === sent`). */
function recipientDeliveryBadgeClass(r: WhatsAppCampaignRecipientRow): string {
  if (r.send_status === "sent") {
    const m = (r.wa_delivery_status ?? "sent").toLowerCase();
    if (m === "read") return "bg-violet-100 text-violet-900 ring-1 ring-violet-200/80";
    if (m === "delivered") return "bg-sky-100 text-sky-900 ring-1 ring-sky-200/80";
    if (m === "failed") return "bg-red-100 text-red-900 ring-1 ring-red-200/80";
    return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80";
  }
  return statusBadgeClass(r.send_status);
}

function recipientDeliveryStatusLabel(
  r: WhatsAppCampaignRecipientRow,
  t: (key: string, options?: { defaultValue?: string }) => string,
): string {
  if (r.send_status === "sent") {
    const meta = (r.wa_delivery_status ?? "sent").toLowerCase();
    return t(`whatsappTemplates.campaign.detail.metaStatus.${meta}`, { defaultValue: meta });
  }
  return t(`whatsappTemplates.campaign.detail.pipelineStatus.${r.send_status}`, {
    defaultValue: r.send_status,
  });
}

export type CampaignDetailPanelProps = {
  campaignId: string | null;
  onClose: () => void;
  listNameById: Map<string, string>;
  waAccounts: WhatsAppAccount[];
  formatDt: (iso: string | null | undefined) => string;
  className?: string;
};

export function CampaignDetailPanel({
  campaignId,
  onClose,
  listNameById,
  waAccounts,
  formatDt,
  className,
}: CampaignDetailPanelProps) {
  const { t } = useTranslation();
  const { data: camp, isLoading: campLoading, isError: campError } = useWhatsAppCampaign(campaignId);
  const { data: recipients = [], isLoading: recLoading } = useWhatsAppCampaignRecipients(campaignId);

  const row = (label: string, value: ReactNode) => (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );

  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-slate-50/60 shadow-inner",
        className,
      )}
      aria-labelledby="campaign-detail-heading"
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-3">
        <h2 id="campaign-detail-heading" className="min-w-0 pr-2 text-base font-semibold text-slate-900">
          {camp?.name ?? t("whatsappTemplates.campaign.detail.fallbackTitle")}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-slate-900"
          onClick={onClose}
          aria-label={t("whatsappTemplates.campaign.detail.close")}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {campLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            {t("whatsappTemplates.campaign.detail.loading")}
          </div>
        ) : campError || !camp ? (
          <p className="text-sm text-red-600">{t("whatsappTemplates.campaign.detail.loadError")}</p>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {row(
                t("whatsappTemplates.campaign.col.status"),
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(camp.status)}`}
                >
                  {camp.status}
                </span>,
              )}
              {row(
                t("whatsappTemplates.campaign.col.template"),
                `${camp.template_name} · ${camp.template_language}`,
              )}
              {row(
                t("whatsappTemplates.campaign.col.list"),
                listNameById.get(camp.recipient_list_id) ?? camp.recipient_list_id,
              )}
              {row(t("whatsappTemplates.campaign.detail.sender"), senderLabel(waAccounts, camp.whatsapp_account_id))}
              {row(t("whatsappTemplates.campaign.col.sent"), String(camp.sent_count))}
              {row(t("whatsappTemplates.campaign.col.read"), String(camp.read_count ?? 0))}
              {row(t("whatsappTemplates.campaign.col.failed"), String(camp.failed_count))}
              {row(t("whatsappTemplates.campaign.col.scheduled"), formatDt(camp.scheduled_at))}
              {row(t("whatsappTemplates.campaign.detail.started"), formatDt(camp.started_at))}
              {row(t("whatsappTemplates.campaign.detail.finished"), formatDt(camp.finished_at))}
              {row(t("whatsappTemplates.campaign.col.created"), formatDt(camp.created_at))}
              {camp.last_error
                ? row(t("whatsappTemplates.campaign.col.error"), <span className="text-red-700">{camp.last_error}</span>)
                : null}
            </dl>

            <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-800">
              {t("whatsappTemplates.campaign.detail.recipients")}
            </h3>
            {recLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                {t("whatsappTemplates.campaign.detail.loading")}
              </div>
            ) : recipients.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="max-h-[min(40vh,320px)] overflow-auto rounded-md border border-slate-200 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="max-w-[12rem] text-xs font-medium">
                        {t("whatsappTemplates.campaign.detail.recipientName")}
                      </TableHead>
                      <TableHead className="text-xs font-medium">{t("whatsappTemplates.campaign.detail.phone")}</TableHead>
                      <TableHead className="text-xs font-medium">{t("whatsappTemplates.campaign.col.status")}</TableHead>
                      <TableHead className="text-xs font-medium">{t("whatsappTemplates.campaign.detail.waMessageId")}</TableHead>
                      <TableHead className="min-w-[6rem] text-xs font-medium">{t("whatsappTemplates.campaign.col.error")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="max-w-[12rem] truncate text-sm text-slate-900" title={r.recipient_name}>
                          {r.recipient_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">{displayE164(r.phone_e164)}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${recipientDeliveryBadgeClass(r)}`}
                          >
                            {recipientDeliveryStatusLabel(r, t)}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[8rem] truncate font-mono text-xs" title={r.wa_message_id ?? undefined}>
                          {r.wa_message_id ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[10rem] truncate text-xs text-red-700/90" title={r.error_detail ?? undefined}>
                          {r.error_detail ?? "—"}
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
    </section>
  );
}
