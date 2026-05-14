import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import type { TemplateTableRow } from "../types";
import { TemplateStatusBadge } from "./TemplateStatusBadge";
import { WhatsAppTemplatePhonePreview } from "./WhatsAppTemplatePhonePreview";

export function TemplateDetailPanel({
  row,
  onBack,
  metaRefetching,
}: {
  row: TemplateTableRow;
  onBack: () => void;
  /** True while re-fetching full template payload from Meta (hsm_id read). */
  metaRefetching?: boolean;
}) {
  const bodyForPreview = row.bodyFull?.trim() ? row.bodyFull : row.bodyPreview;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start gap-3 border-b border-slate-200 pb-3">
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Kembali ke daftar
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900">Detail template</h2>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{row.templateName}</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] lg:items-start lg:gap-8">
        <dl className="min-w-0 space-y-3 text-sm lg:max-w-none">
          <div>
            <dt className="font-medium text-slate-600">Name</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{row.templateName}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-600">Meta template ID</dt>
            <dd className="mt-0.5 font-mono text-xs text-slate-800">{row.id}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-600">Language</dt>
            <dd className="mt-0.5">
              <span className="font-medium tabular-nums">{row.languageLabel}</span>
              {row.languageCode !== "—" ? (
                <span className="ml-2 text-xs text-muted-foreground">({row.languageCode})</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-600">Category</dt>
            <dd className="mt-0.5">{row.categoryDisplay}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-600">Media header</dt>
            <dd className="mt-0.5">{row.mediaFormat ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-600">Status</dt>
            <dd className="mt-0.5">
              <TemplateStatusBadge label={row.statusLabel} />
              <span className="ml-2 text-xs text-muted-foreground">({row.statusRaw})</span>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-600">Body (teks Meta)</dt>
            <dd className="mt-0.5 whitespace-pre-wrap break-words rounded-md border border-slate-100 bg-slate-50/80 px-2 py-2 font-mono text-xs text-slate-800">
              {bodyForPreview || "—"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-600">Top block reason</dt>
            <dd className="mt-0.5 text-slate-800">{row.topBlockReason?.trim() ? row.topBlockReason : "—"}</dd>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-600">Created at</dt>
              <dd className="mt-0.5">{row.createdAt ? format(row.createdAt, "d MMM yyyy HH:mm") : "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600">Last edited</dt>
              <dd className="mt-0.5">{row.lastEditedAt ? format(row.lastEditedAt, "d MMM yyyy HH:mm") : "—"}</dd>
            </div>
          </div>
        </dl>

        <div className="min-w-0 shrink-0 rounded-xl border border-slate-200 bg-slate-50/60 p-4 lg:sticky lg:top-2">
          <WhatsAppTemplatePhonePreview
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
      </div>
    </div>
  );
}
