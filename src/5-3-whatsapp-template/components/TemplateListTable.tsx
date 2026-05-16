import { useMemo } from "react";
import { ArrowDown, ArrowUp, HelpCircle, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import type { TemplateTableRow } from "../types";
import { templateDeleteBlockReason } from "../utils/templateDeleteRules";
import { TemplateStatusBadge } from "./TemplateStatusBadge";

export type SortKey =
  | "templateName"
  | "categoryDisplay"
  | "languageLabel"
  | "mediaFormat"
  | "statusLabel"
  | "messagesDelivered"
  | "readRatePercent"
  | "topBlockReason"
  | "createdAt"
  | "lastEditedAt";

export function TemplateListTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  selectedIds,
  onToggleRow,
  onToggleAllVisible,
  onViewDetails,
  onRequestDelete,
  deletingTemplateId,
}: {
  rows: TemplateTableRow[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  selectedIds: Set<string>;
  onToggleRow: (id: string, checked: boolean) => void;
  onToggleAllVisible: (checked: boolean) => void;
  onViewDetails: (row: TemplateTableRow) => void;
  onRequestDelete: (row: TemplateTableRow) => void;
  deletingTemplateId: string | null;
}) {
  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = visibleIds.some((id) => selectedIds.has(id));

  const SortHead = ({
    label,
    k,
    info,
    className,
  }: {
    label: string;
    k: SortKey;
    info?: string;
    className?: string;
  }) => {
    const active = sortKey === k;
    return (
      <TableHead className={cn("whitespace-nowrap font-medium text-slate-700", className)}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex items-center gap-0.5 rounded hover:bg-slate-100 px-0.5 py-0.5 text-left"
            onClick={() => onSort(k)}
          >
            <span>{label}</span>
            <span className="flex flex-col leading-none">
              <ArrowUp className={cn("h-3 w-3", active && sortDir === "asc" ? "text-brand-blue" : "text-slate-300")} />
              <ArrowDown className={cn("-mt-1 h-3 w-3", active && sortDir === "desc" ? "text-brand-blue" : "text-slate-300")} />
            </span>
          </button>
          {info ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-slate-400 hover:text-slate-600" aria-label={info}>
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {info}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </TableHead>
    );
  };

  return (
    <Table containerClassName="rounded-md border border-slate-200">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-10 px-2">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(v) => onToggleAllVisible(v === true)}
              aria-label="Select all on page"
            />
          </TableHead>
          <SortHead label="Template name" k="templateName" className="min-w-[10rem]" />
          <SortHead label="Category" k="categoryDisplay" />
          <SortHead label="Language" k="languageLabel" className="min-w-[5rem]" />
          <SortHead
            label="Media"
            k="mediaFormat"
            className="min-w-[5.5rem]"
            info="Tipe media dari komponen HEADER Meta (`IMAGE`, `VIDEO`, atau `DOCUMENT`). Template teks-only menampilkan —."
          />
          <SortHead label="Status" k="statusLabel" className="min-w-[8rem]" />
          <SortHead
            label="Messages delivered"
            k="messagesDelivered"
            info="Jumlah pesan template yang terkirim. Nilai detail memerlukan integrasi analitik Meta; saat ini dapat ditampilkan sebagai —."
          />
          <SortHead
            label="Read rate"
            k="readRatePercent"
            info="Persentase dibaca. Memerlukan integrasi analitik Meta; saat ini dapat ditampilkan sebagai —."
          />
          <SortHead
            label="Top block reason"
            k="topBlockReason"
            info="Alasan pemblokiran template jika tersedia dari Meta."
          />
          <SortHead
            label="Created at"
            k="createdAt"
            className="min-w-[6.5rem]"
            info="Dari Meta: `created_time` bila dikembalikan API; jika tidak ada, dipakai `last_updated_time` pada node template yang sama."
          />
          <SortHead label="Last edited" k="lastEditedAt" className="min-w-[6.5rem]" />
          <TableHead className="w-12 text-right font-medium text-slate-700">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={12} className="h-24 text-center text-sm text-muted-foreground">
              Tidak ada template yang cocok dengan filter.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.id} className="border-slate-100">
              <TableCell className="px-2">
                <Checkbox
                  checked={selectedIds.has(row.id)}
                  onCheckedChange={(v) => onToggleRow(row.id, v === true)}
                  aria-label={`Select ${row.templateName}`}
                />
              </TableCell>
              <TableCell className="align-top">
                <div className="font-semibold text-slate-900">{row.templateName}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{row.bodyPreview || "—"}</div>
              </TableCell>
              <TableCell className="align-top text-sm">{row.categoryDisplay}</TableCell>
              <TableCell className="align-top">
                <div className="text-sm font-medium tabular-nums tracking-wide" title={row.languageCode !== "—" ? row.languageCode : undefined}>
                  {row.languageLabel}
                </div>
              </TableCell>
              <TableCell className="align-top text-sm font-medium tabular-nums text-slate-700" title={row.mediaFormat ?? undefined}>
                {row.mediaFormat ?? "—"}
              </TableCell>
              <TableCell className="align-top">
                <TemplateStatusBadge label={row.statusLabel} />
              </TableCell>
              <TableCell className="align-top text-center text-sm tabular-nums text-slate-700">
                {row.messagesDelivered == null ? "—" : row.messagesDelivered}
              </TableCell>
              <TableCell className="align-top text-center text-sm tabular-nums text-slate-700">
                {row.readRatePercent == null ? "—" : `${row.readRatePercent}%`}
              </TableCell>
              <TableCell className="align-top text-sm text-slate-600">{row.topBlockReason?.trim() ? row.topBlockReason : "—"}</TableCell>
              <TableCell className="align-top text-sm text-slate-700">
                {row.createdAt ? format(row.createdAt, "d MMM yyyy") : "—"}
              </TableCell>
              <TableCell className="align-top text-sm text-slate-700">
                {row.lastEditedAt ? format(row.lastEditedAt, "d MMM yyyy") : "—"}
              </TableCell>
              <TableCell className="align-top text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-slate-600"
                      aria-label={`Actions for ${row.templateName}`}
                      disabled={deletingTemplateId === row.id}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[10rem]">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => {
                        queueMicrotask(() => {
                          onViewDetails(row);
                        });
                      }}
                    >
                      View details
                    </DropdownMenuItem>
                    {(() => {
                      const deleteBlock = templateDeleteBlockReason(row.statusRaw);
                      return (
                    <DropdownMenuItem
                      className="cursor-pointer text-red-600 focus:text-red-600"
                      onSelect={() => {
                        if (deleteBlock) return;
                        queueMicrotask(() => {
                          onRequestDelete(row);
                        });
                      }}
                      disabled={deletingTemplateId === row.id || Boolean(deleteBlock)}
                      title={deleteBlock ?? undefined}
                    >
                      Delete
                    </DropdownMenuItem>
                      );
                    })()}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
