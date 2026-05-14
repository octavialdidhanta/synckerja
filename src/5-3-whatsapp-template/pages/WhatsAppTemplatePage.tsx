import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { HeaderAndTab } from "@/5-3-dashboard/components/layout/HeaderAndTab";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import { useWhatsAppAccounts } from "@/5-3-whatsapp/hooks/useWhatsAppAccounts";
import { useWhatsAppMessageTemplates } from "../hooks/useWhatsAppMessageTemplates";
import { useDeleteWhatsAppMessageTemplate } from "../hooks/useDeleteWhatsAppMessageTemplate";
import { mapMetaTemplateToRow } from "../utils/mapMetaTemplateToRow";
import type { DateRangePreset, MetaMessageTemplate, StatusFilterOption, TemplateTableRow } from "../types";
import { TemplateManagerShell, type TemplateManagerSubTab } from "../components/TemplateManagerShell";
import { TemplateListToolbar } from "../components/TemplateListToolbar";
import { TemplateListTable, type SortKey } from "../components/TemplateListTable";
import { TemplateDetailPanel } from "../components/TemplateDetailPanel";
import { useWhatsAppMessageTemplateByHsmId } from "../hooks/useWhatsAppMessageTemplateByHsmId";
import { WhatsAppTemplateEmptyState } from "../components/WhatsAppTemplateEmptyState";
import { CreateTemplateWizard } from "../components/CreateTemplateWizard";

const MAX_ACTIVE_TEMPLATES = 6000;

function dateCutoffMs(preset: Exclude<DateRangePreset, "all">): number {
  const days = preset === "7" ? 7 : preset === "30" ? 30 : preset === "60" ? 60 : 90;
  return Date.now() - days * 86400000;
}

function sortRows(rows: TemplateTableRow[], key: SortKey, dir: "asc" | "desc"): TemplateTableRow[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let va: string | number | Date | null = null;
    let vb: string | number | Date | null = null;
    switch (key) {
      case "templateName":
        va = a.templateName.toLowerCase();
        vb = b.templateName.toLowerCase();
        break;
      case "categoryDisplay":
        va = a.categoryDisplay;
        vb = b.categoryDisplay;
        break;
      case "languageLabel":
        va = a.languageLabel;
        vb = b.languageLabel;
        break;
      case "statusLabel":
        va = a.statusLabel;
        vb = b.statusLabel;
        break;
      case "messagesDelivered":
        va = a.messagesDelivered ?? -1;
        vb = b.messagesDelivered ?? -1;
        break;
      case "readRatePercent":
        va = a.readRatePercent ?? -1;
        vb = b.readRatePercent ?? -1;
        break;
      case "topBlockReason":
        va = a.topBlockReason ?? "";
        vb = b.topBlockReason ?? "";
        break;
      case "createdAt":
        va = a.createdAt?.getTime() ?? 0;
        vb = b.createdAt?.getTime() ?? 0;
        break;
      case "lastEditedAt":
        va = a.lastEditedAt?.getTime() ?? 0;
        vb = b.lastEditedAt?.getTime() ?? 0;
        break;
      case "mediaFormat":
        va = (a.mediaFormat ?? "").toLowerCase();
        vb = (b.mediaFormat ?? "").toLowerCase();
        break;
      default:
        break;
    }
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
    if (va instanceof Date && vb instanceof Date) return (va.getTime() - vb.getTime()) * mul;
    return String(va).localeCompare(String(vb), undefined, { sensitivity: "base" }) * mul;
  });
}

function isNotConfiguredTemplatesError(err: unknown): boolean {
  if (!err || !(err instanceof Error)) return false;
  const code = (err as Error & { code?: string }).code;
  if (code === "WHATSAPP_NOT_CONFIGURED") return true;
  return /WhatsApp Business Account not configured|missing access token/i.test(err.message);
}

export function WhatsAppTemplatePage() {
  const { organizationId } = useCurrentOrg();
  const { accounts: whatsappAccounts, isLoading: whatsappAccountsLoading } = useWhatsAppAccounts();
  const [selectedWhatsappAccountId, setSelectedWhatsappAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setSelectedWhatsappAccountId(null);
      return;
    }
    if (whatsappAccounts.length === 0) {
      setSelectedWhatsappAccountId(null);
      return;
    }
    setSelectedWhatsappAccountId((prev) =>
      prev && whatsappAccounts.some((a) => a.id === prev) ? prev : whatsappAccounts[0].id,
    );
  }, [organizationId, whatsappAccounts]);

  const { data, isLoading, isError, isFetched, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useWhatsAppMessageTemplates(selectedWhatsappAccountId);

  const [subTab, setSubTab] = useState<TemplateManagerSubTab>("templates");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [languageFilters, setLanguageFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<StatusFilterOption[]>([]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastEditedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<TemplateTableRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateTableRow | null>(null);

  const detailMetaQuery = useWhatsAppMessageTemplateByHsmId({
    hsmId: detailRow?.id ?? null,
    whatsappAccountId: selectedWhatsappAccountId,
  });

  const displayDetailRow = useMemo((): TemplateTableRow | null => {
    if (!detailRow) return null;
    const arr = detailMetaQuery.data?.data;
    const first = Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    if (first) {
      const mapped = mapMetaTemplateToRow(first as MetaMessageTemplate);
      if (mapped) return mapped;
    }
    return detailRow;
  }, [detailRow, detailMetaQuery.data]);

  useEffect(() => {
    if (!organizationId) setDetailRow(null);
  }, [organizationId]);

  useEffect(() => {
    if (subTab !== "templates") setDetailRow(null);
  }, [subTab]);

  const deleteMutation = useDeleteWhatsAppMessageTemplate();

  const rawRows = useMemo(() => {
    const pages = data?.pages ?? [];
    const items: MetaMessageTemplate[] = pages.flatMap((p) => p.data ?? []);
    const mapped = items.map((m) => mapMetaTemplateToRow(m)).filter((r): r is TemplateTableRow => r != null);
    const seen = new Set<string>();
    return mapped.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [data]);

  const languageOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rawRows) s.add(r.languageLabel);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [rawRows]);

  const dateFilterDisabled = useMemo(
    () => !rawRows.some((r) => r.lastEditedAt != null || r.createdAt != null),
    [rawRows],
  );

  const filteredSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = rawRows.filter((r) => {
      if (q && !r.templateName.toLowerCase().includes(q) && !r.bodyPreview.toLowerCase().includes(q)) return false;
      if (categoryFilters.length > 0 && !categoryFilters.includes(r.categoryFilter)) return false;
      if (languageFilters.length > 0 && !languageFilters.includes(r.languageLabel)) return false;
      if (statusFilters.length > 0 && !statusFilters.includes(r.statusLabel as StatusFilterOption)) return false;
      if (!dateFilterDisabled && datePreset !== "all") {
        const t = Math.max(r.createdAt?.getTime() ?? 0, r.lastEditedAt?.getTime() ?? 0);
        if (t > 0 && t < dateCutoffMs(datePreset)) return false;
      }
      return true;
    });
    list = sortRows(list, sortKey, sortDir);
    return list;
  }, [rawRows, searchQuery, categoryFilters, languageFilters, statusFilters, datePreset, dateFilterDisabled, sortKey, sortDir]);

  const activeApprovedCount = useMemo(() => rawRows.filter((r) => r.statusRaw === "APPROVED").length, [rawRows]);

  const onSort = useCallback((k: SortKey) => {
    setSortKey((prev) => {
      if (prev === k) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(k === "lastEditedAt" || k === "createdAt" ? "desc" : "asc");
      return k;
    });
  }, []);

  const onToggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (checked) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const onToggleAllVisible = (checked: boolean) => {
    setSelectedIds(() => {
      if (!checked) return new Set();
      return new Set(filteredSorted.map((r) => r.id));
    });
  };

  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilters([]);
    setLanguageFilters([]);
    setStatusFilters([]);
    setDatePreset("all");
  };

  const handleViewDetails = useCallback((row: TemplateTableRow) => {
    setWizardOpen(false);
    setDetailRow(row);
  }, []);

  const handleRequestDelete = useCallback((row: TemplateTableRow) => {
    setDeleteTarget(row);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({
        hsmId: deleteTarget.id,
        whatsappAccountId: selectedWhatsappAccountId,
      });
      toast.success(`Template "${deleteTarget.templateName}" dihapus di WhatsApp (Meta).`);
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(deleteTarget.id);
        return n;
      });
      setDetailRow((d) => (d?.id === deleteTarget.id ? null : d));
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus template");
    }
  }, [deleteTarget, deleteMutation, selectedWhatsappAccountId]);

  /** Jangan tebak dari tabel akun di klien (RLS / data bisa kosong); satu sumber kebenaran = respons Edge Function. */
  const serverSaysNotConfigured = isFetched && isError && isNotConfiguredTemplatesError(error);

  const errorDetail = isError && error instanceof Error ? error.message : null;

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-1 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <TemplateManagerShell activeSubTab={subTab} onSubTabChange={setSubTab}>
              {!organizationId ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-muted-foreground">
                  Pilih organisasi aktif untuk memuat template WhatsApp.
                </div>
              ) : serverSaysNotConfigured ? (
                <WhatsAppTemplateEmptyState reason="not_configured" />
              ) : isError ? (
                <WhatsAppTemplateEmptyState reason="error" detail={errorDetail} />
              ) : (
                <>
                  {detailRow && displayDetailRow ? (
                    <div className="mt-4 min-h-0 min-w-0 flex-1">
                      <TemplateDetailPanel
                        row={displayDetailRow}
                        onBack={() => setDetailRow(null)}
                        metaRefetching={detailMetaQuery.isFetching}
                      />
                    </div>
                  ) : (
                    <>
                      <TemplateListToolbar
                        searchQuery={searchQuery}
                        onSearchQueryChange={setSearchQuery}
                        categoryFilters={categoryFilters}
                        onCategoryFiltersChange={setCategoryFilters}
                        languageOptions={languageOptions}
                        languageFilters={languageFilters}
                        onLanguageFiltersChange={setLanguageFilters}
                        statusFilters={statusFilters}
                        onStatusFiltersChange={setStatusFilters}
                        datePreset={datePreset}
                        onDatePresetChange={setDatePreset}
                        dateFilterDisabled={dateFilterDisabled}
                        onResetFilters={resetFilters}
                        onCreateClick={() => {
                          setDetailRow(null);
                          setWizardOpen(true);
                        }}
                        whatsappAccounts={whatsappAccounts}
                        whatsappAccountsLoading={whatsappAccountsLoading}
                        selectedWhatsappAccountId={selectedWhatsappAccountId}
                        onSelectedWhatsappAccountIdChange={setSelectedWhatsappAccountId}
                      />

                      {isLoading ? (
                        <div className="mt-4 h-48 animate-pulse rounded-md bg-slate-100" aria-busy aria-label="Loading templates" />
                      ) : rawRows.length === 0 ? (
                        <div className="mt-4">
                          <WhatsAppTemplateEmptyState reason="none" />
                        </div>
                      ) : (
                        <>
                          <div className="mt-4">
                            <TemplateListTable
                              rows={filteredSorted}
                              sortKey={sortKey}
                              sortDir={sortDir}
                              onSort={onSort}
                              selectedIds={selectedIds}
                              onToggleRow={onToggleRow}
                              onToggleAllVisible={onToggleAllVisible}
                              onViewDetails={handleViewDetails}
                              onRequestDelete={handleRequestDelete}
                              deletingTemplateId={deleteMutation.isPending && deleteTarget ? deleteTarget.id : null}
                            />
                          </div>
                          <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                            <p>
                              {filteredSorted.length} message templates shown (total active templates: {activeApprovedCount} of{" "}
                              {MAX_ACTIVE_TEMPLATES})
                            </p>
                            {hasNextPage ? (
                              <Button type="button" variant="outline" size="sm" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                                {isFetchingNextPage ? "Loading…" : "Load more"}
                              </Button>
                            ) : null}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </TemplateManagerShell>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <CreateTemplateWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        whatsappAccountId={selectedWhatsappAccountId}
        onWhatsappAccountIdChange={setSelectedWhatsappAccountId}
      />

      <AlertDialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus template di Meta?</AlertDialogTitle>
            <AlertDialogDescription>
              Template{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.templateName}</span> akan dihapus permanen
              dari akun WhatsApp Business (Meta). Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Batal</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => void handleConfirmDelete()}
            >
              {deleteMutation.isPending ? "Menghapus…" : "Hapus"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
