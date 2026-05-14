import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, Eye, Trash2 } from "lucide-react";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useToast } from "@/shared/hooks/use-toast";
import "@/2-1-employees/section/EmployeeTable.css";
import type { RecipientListRow, RecipientSource, RecipientUploadStatus } from "./mockRecipientListsData";
import { RecipientListsTableFooter } from "./RecipientListsTableFooter";

export type RecipientSortKey = "contacts" | "createdAt";
export type SortDir = "asc" | "desc";

type RecipientListsTableProps = {
  rows: RecipientListRow[];
  isLoading?: boolean;
  sortKey: RecipientSortKey;
  sortDir: SortDir;
  onSortChange: (key: RecipientSortKey) => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  /** When set, "Delete list" opens parent confirmation and deletes via Supabase. */
  onRequestDeleteList?: (row: RecipientListRow) => void;
  /** When set, "View details" navigates to the recipient list detail route. */
  onRequestViewDetails?: (row: RecipientListRow) => void;
};

function uploadStatusBadgeClass(status: RecipientUploadStatus): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 border-green-200";
    case "processing":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "failed":
      return "bg-red-100 text-red-800 border-red-200";
    case "draft":
      return "bg-slate-100 text-slate-800 border-slate-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function formatCreatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function RecipientListsTable({
  rows,
  isLoading = false,
  sortKey,
  sortDir,
  onSortChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onRequestDeleteList,
  onRequestViewDetails,
}: RecipientListsTableProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const sliceStart = (safePage - 1) * pageSize;
  const pageRows = useMemo(() => rows.slice(sliceStart, sliceStart + pageSize), [rows, sliceStart, pageSize]);

  const headers = useMemo(
    () =>
      [
        { key: "name" as const, label: t("whatsappTemplates.recipientLists.col.name"), width: "w-56", sortable: false },
        { key: "channel" as const, label: t("whatsappTemplates.recipientLists.col.channel"), width: "w-36", sortable: false },
        { key: "contacts" as const, label: t("whatsappTemplates.recipientLists.col.contacts"), width: "w-36", sortable: true },
        { key: "uploadStatus" as const, label: t("whatsappTemplates.recipientLists.col.uploadStatus"), width: "w-40", sortable: false },
        { key: "source" as const, label: t("whatsappTemplates.recipientLists.col.source"), width: "w-40", sortable: false },
        { key: "createdAt" as const, label: t("whatsappTemplates.recipientLists.col.creationDate"), width: "w-40", sortable: true },
        { key: "actions" as const, label: t("whatsappTemplates.recipientLists.col.actions"), width: "w-20", sortable: false },
      ] as const,
    [t],
  );

  const labelSource = useCallback(
    (s: RecipientSource) =>
      s === "file_upload" ? t("whatsappTemplates.recipientLists.source.fileUpload") : t("whatsappTemplates.recipientLists.source.contacts"),
    [t],
  );

  const labelStatus = useCallback(
    (s: RecipientUploadStatus) => {
      if (s === "completed") return t("whatsappTemplates.recipientLists.status.completed");
      if (s === "processing") return t("whatsappTemplates.recipientLists.status.processing");
      if (s === "failed") return t("whatsappTemplates.recipientLists.status.failed");
      if (s === "draft") return t("whatsappTemplates.recipientLists.status.draft");
      return t("whatsappTemplates.recipientLists.status.completed");
    },
    [t],
  );

  const SortIcon = ({ column }: { column: RecipientSortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
    );
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto">
        <table className="employee-table w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-20 bg-gray-50 shadow-sm">
            <TableRow className="hover:bg-transparent">
              {headers.map((header) => (
                <TableHead
                  key={header.key}
                  className={`whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700 ${header.width}`}
                >
                  {header.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-sm py-0.5 text-left text-xs font-medium text-gray-700 hover:text-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                      onClick={() => onSortChange(header.key as RecipientSortKey)}
                    >
                      {header.label}
                      <SortIcon column={header.key as RecipientSortKey} />
                    </button>
                  ) : (
                    header.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64 max-w-full" />
                    <Skeleton className="h-4 w-52 max-w-full" />
                  </div>
                </TableCell>
              </TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-gray-500">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="text-lg" aria-hidden>
                      📋
                    </div>
                    <div>{t("whatsappTemplates.recipientLists.empty.title")}</div>
                    <div className="text-xs text-gray-400">{t("whatsappTemplates.recipientLists.empty.hint")}</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={row.id} className="h-12 transition-colors hover:bg-gray-50/50">
                  <TableCell className="w-56 px-4">
                    <div className="truncate text-sm font-medium text-gray-900" title={row.name}>
                      {row.name}
                    </div>
                  </TableCell>
                  <TableCell className="w-36 px-3 text-sm text-gray-800">{row.channel}</TableCell>
                  <TableCell className="w-36 px-3 text-sm tabular-nums text-gray-900">{row.contacts.toLocaleString()}</TableCell>
                  <TableCell className="w-40 px-3">
                    <Badge className={`${uploadStatusBadgeClass(row.uploadStatus)} border px-2 py-1 text-xs`}>
                      {labelStatus(row.uploadStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-40 px-3 text-sm text-gray-800">{labelSource(row.source)}</TableCell>
                  <TableCell className="w-40 px-3 text-sm whitespace-nowrap text-gray-800">{formatCreatedAt(row.createdAt)}</TableCell>
                  <TableCell className="w-20 px-3 text-right align-middle">
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">{t("whatsappTemplates.recipientLists.actions.open")}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[10rem]">
                          <DropdownMenuItem
                            className="text-sm"
                            onSelect={() => {
                              if (onRequestViewDetails) {
                                setTimeout(() => onRequestViewDetails(row), 0);
                              } else {
                                toast({
                                  title: t("whatsappTemplates.recipientLists.toast.viewTitle"),
                                  description: row.name,
                                });
                              }
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            {t("whatsappTemplates.recipientLists.actions.viewDetails")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-sm text-destructive focus:text-destructive"
                            onSelect={() => {
                              if (onRequestDeleteList) {
                                setTimeout(() => onRequestDeleteList(row), 0);
                              } else {
                                toast({
                                  variant: "destructive",
                                  title: t("whatsappTemplates.recipientLists.toast.deleteTitle"),
                                  description: row.name,
                                });
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("whatsappTemplates.recipientLists.actions.deleteList")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>

      <RecipientListsTableFooter
        totalRows={totalRows}
        page={safePage}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
