import type { ReactNode } from "react";
import { format } from "date-fns";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import type { TemplateTableRow } from "../types";
import { TemplateQualityBadge } from "./TemplateQualityBadge";
import { TemplateStatusBadge } from "./TemplateStatusBadge";
import { WhatsAppTemplatePhonePreview } from "./WhatsAppTemplatePhonePreview";

function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="font-medium text-slate-600">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{children}</dd>
    </div>
  );
}

export function TemplateDetailPanel({
  row,
  onBack,
  onRequestDelete,
  deleteBlockReason = null,
  isDeleting = false,
  metaRefetching,
}: {
  row: TemplateTableRow;
  onBack: () => void;
  onRequestDelete: () => void;
  /** When set, delete is blocked (Meta status rules). */
  deleteBlockReason?: string | null;
  isDeleting?: boolean;
  /** True while re-fetching full template payload from Meta (hsm_id read). */
  metaRefetching?: boolean;
}) {
  const bodyForPreview = row.bodyFull?.trim() ? row.bodyFull : row.bodyPreview;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-start gap-3 border-b border-slate-200 pb-3">
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Kembali ke daftar
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900">Detail template</h2>
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto pt-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid min-w-0 grid-cols-1 gap-6 pb-2 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
          <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
            <DetailField label="Name">
              <span className="font-semibold text-slate-900">{row.templateName}</span>
            </DetailField>

            <DetailField label="Meta template ID">
              <span className="break-all font-mono text-xs">{row.id}</span>
            </DetailField>

            <DetailField label="Language">
              <span className="font-medium tabular-nums">{row.languageLabel}</span>
              {row.languageCode !== "—" ? (
                <span className="ml-2 text-xs text-muted-foreground">({row.languageCode})</span>
              ) : null}
            </DetailField>

            <DetailField label="Category">{row.categoryDisplay}</DetailField>

            <DetailField label="Media header">{row.mediaFormat ?? "—"}</DetailField>

            <DetailField label="Status">
              <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                <TemplateStatusBadge label={row.statusLabel} />
                <span className="text-xs text-muted-foreground">({row.statusRaw})</span>
              </span>
            </DetailField>

            <DetailField label="Quality">
              <TemplateQualityBadge
                label={row.qualityLabel}
                qualityRaw={row.qualityRaw}
                title={
                  !row.qualityFromMeta
                    ? "Meta tidak mengirim quality_score pada respons API."
                    : row.qualityRaw === "UNKNOWN"
                      ? "Rating Meta masih menunggu feedback pelanggan (UNKNOWN)."
                      : undefined
                }
              />
            </DetailField>

            <DetailField label="Body (teks Meta)" className="sm:col-span-2 xl:col-span-3">
              <div className="max-h-64 overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-slate-100 bg-slate-50/80 px-2 py-2 font-mono text-xs text-slate-800">
                {bodyForPreview || "—"}
              </div>
            </DetailField>

            <DetailField label="Top block reason" className="sm:col-span-2 xl:col-span-3">
              {row.topBlockReason?.trim() ? row.topBlockReason : "—"}
            </DetailField>

            <DetailField label="Created at">
              {row.createdAt ? format(row.createdAt, "d MMM yyyy HH:mm") : "—"}
            </DetailField>

            <DetailField label="Last edited">
              {row.lastEditedAt ? format(row.lastEditedAt, "d MMM yyyy HH:mm") : "—"}
            </DetailField>
          </dl>

          <div className="flex w-full min-w-0 shrink-0 flex-col gap-3">
            <div className="flex justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <WhatsAppTemplatePhonePreview
                className="min-w-0"
                headerText={row.headerText}
                mediaFormat={row.mediaFormat}
                headerMediaPreviewUrl={row.headerMediaPreviewUrl}
                bodyText={bodyForPreview}
                bodyVariableExamples={row.bodyVariableExamples}
                headerVariableExamples={row.headerVariableExamples}
                footerText={row.footerText}
                buttonLabels={row.previewButtonLabels}
                previewAt={row.lastEditedAt ?? row.createdAt}
                metaSyncLoading={metaRefetching}
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              className="w-full gap-2"
              disabled={isDeleting || Boolean(deleteBlockReason)}
              title={deleteBlockReason ?? undefined}
              onClick={onRequestDelete}
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              {isDeleting ? "Menghapus…" : "Hapus template"}
            </Button>
            {deleteBlockReason ? (
              <p className="text-center text-xs leading-snug text-muted-foreground">{deleteBlockReason}</p>
            ) : (
              <p className="text-center text-xs leading-snug text-muted-foreground">
                Menghapus template di Meta tidak dapat dibatalkan.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
