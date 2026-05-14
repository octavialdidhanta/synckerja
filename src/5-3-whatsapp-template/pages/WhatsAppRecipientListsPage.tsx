import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HeaderAndTab } from "@/5-3-dashboard/components/layout/HeaderAndTab";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { useToast } from "@/shared/hooks/use-toast";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import {
  RecipientListsToolbar,
  type RecipientListSourceFilter,
  type RecipientListStatusFilter,
} from "@/5-3-whatsapp-template/components/recipient-lists/RecipientListsToolbar";
import {
  RecipientListsTable,
  type RecipientSortKey,
  type SortDir,
} from "@/5-3-whatsapp-template/components/recipient-lists/RecipientListsTable";
import type { RecipientListRow, RecipientSource, RecipientUploadStatus } from "@/5-3-whatsapp-template/components/recipient-lists/mockRecipientListsData";
import { AddContactsToRecipientListModal } from "@/5-3-whatsapp-template/components/recipient-lists/AddContactsToRecipientListModal";
import { ImportRecipientListFileModal } from "@/5-3-whatsapp-template/components/recipient-lists/ImportRecipientListFileModal";
import {
  useActiveOrgOwnerRpc,
  useCreateRecipientListFromSelection,
  useDeleteWhatsappRecipientList,
  useRecipientPickerCandidates,
  useWhatsappRecipientLists,
  type WhatsappRecipientListRow,
} from "@/5-3-whatsapp-template/hooks/useWhatsappRecipientLists";
import type { RecipientPickerCandidate } from "@/5-3-whatsapp-template/utils/buildRecipientPickerCandidates";

function mapDbRowToTableRow(r: WhatsappRecipientListRow): RecipientListRow {
  return {
    id: r.id,
    name: r.name,
    channel: r.channel === "whatsapp" ? "WhatsApp" : r.channel,
    contacts: r.contact_count,
    uploadStatus: r.upload_status as RecipientUploadStatus,
    source: (r.creation_source === "file_upload" ? "file_upload" : "contacts") as RecipientSource,
    createdAt: r.created_at,
  };
}

/**
 * `/omnichannel/campaign/recipient-lists` — DB-backed lists + CRM contact picker (owner-only RLS).
 */
export function WhatsAppRecipientListsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { organizationId } = useCurrentOrg();
  const { data: ownerOk, isLoading: ownerLoading, isError: ownerRpcError } = useActiveOrgOwnerRpc(organizationId);
  const { data: listRows, isLoading: listsLoading, error: listsError } = useWhatsappRecipientLists(organizationId);
  const [selectModalOpen, setSelectModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const {
    data: pickerCandidates = [],
    isFetching: pickerLoading,
    isError: pickerError,
    error: pickerQueryError,
  } = useRecipientPickerCandidates(organizationId, selectModalOpen);
  const pickerErrorMessage = pickerError
    ? pickerQueryError instanceof Error
      ? pickerQueryError.message
      : typeof pickerQueryError === "object" && pickerQueryError !== null && "message" in pickerQueryError
        ? String((pickerQueryError as { message?: unknown }).message ?? pickerQueryError)
        : String(pickerQueryError ?? "Unknown error")
    : null;
  const createList = useCreateRecipientListFromSelection(organizationId);
  const deleteList = useDeleteWhatsappRecipientList(organizationId);

  const [listPendingDelete, setListPendingDelete] = useState<RecipientListRow | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RecipientListStatusFilter>("all");
  const [source, setSource] = useState<RecipientListSourceFilter>("all");
  const [sortKey, setSortKey] = useState<RecipientSortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const tableRows = useMemo(() => (listRows ?? []).map(mapDbRowToTableRow), [listRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tableRows.filter((r) => {
      if (status !== "all" && r.uploadStatus !== status) return false;
      if (source !== "all" && r.source !== source) return false;
      if (q) {
        const inName = r.name.toLowerCase().includes(q);
        const inChannel = r.channel.toLowerCase().includes(q);
        if (!inName && !inChannel) return false;
      }
      return true;
    });
  }, [search, status, source, tableRows]);

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "contacts") cmp = a.contacts - b.contacts;
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredRows, sortKey, sortDir]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [sortedRows.length, pageSize]);

  const onSortChange = useCallback((key: RecipientSortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("desc");
      return key;
    });
  }, []);

  const onCreateUploadFile = useCallback(() => {
    setTimeout(() => setImportModalOpen(true), 0);
  }, []);

  const onCreateSelectContacts = useCallback(() => {
    setSelectModalOpen(true);
  }, []);

  const onRequestDeleteList = useCallback((row: RecipientListRow) => {
    setListPendingDelete(row);
  }, []);

  const onRequestViewDetails = useCallback(
    (row: RecipientListRow) => {
      navigate(`/omnichannel/campaign/recipient-lists/${row.id}`);
    },
    [navigate],
  );

  const confirmDeleteList = useCallback(async () => {
    if (!listPendingDelete) return;
    const name = listPendingDelete.name;
    const id = listPendingDelete.id;
    try {
      await deleteList.mutateAsync(id);
      toast({
        title: t("whatsappTemplates.recipientLists.toast.listDeletedTitle"),
        description: t("whatsappTemplates.recipientLists.toast.listDeletedDescription", { name }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        variant: "destructive",
        title: t("whatsappTemplates.recipientLists.toast.deleteFailedTitle"),
        description: msg,
      });
    } finally {
      setListPendingDelete(null);
    }
  }, [deleteList, listPendingDelete, t, toast]);

  const handleAddContacts = useCallback(
    async (args: { name: string; picks: RecipientPickerCandidate[] }) => {
      try {
        await createList.mutateAsync({ name: args.name, picks: args.picks });
        toast({
          title: t("whatsappTemplates.recipientLists.toast.listCreatedTitle"),
          description: t("whatsappTemplates.recipientLists.toast.listCreatedDescription", {
            name: args.name,
            count: args.picks.length,
          }),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast({
          variant: "destructive",
          title: t("whatsappTemplates.recipientLists.toast.createFailedTitle"),
          description: msg,
        });
        throw e;
      }
    },
    [createList, toast, t],
  );

  useEffect(() => {
    if (listsError) {
      toast({
        variant: "destructive",
        title: t("whatsappTemplates.recipientLists.toast.loadErrorTitle"),
        description: listsError.message,
      });
    }
  }, [listsError, toast, t]);

  useEffect(() => {
    if (ownerRpcError) {
      toast({
        variant: "destructive",
        title: t("whatsappTemplates.recipientLists.toast.ownerCheckErrorTitle"),
        description: t("whatsappTemplates.recipientLists.toast.ownerCheckErrorDescription"),
      });
    }
  }, [ownerRpcError, toast, t]);

  const showOwnerGate = Boolean(organizationId) && !ownerLoading && ownerOk === false;
  const pagePending = (Boolean(organizationId) && ownerLoading) || listsLoading || !organizationId;

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <AddContactsToRecipientListModal
        open={selectModalOpen}
        onOpenChange={setSelectModalOpen}
        candidates={pickerCandidates}
        candidatesLoading={pickerLoading}
        candidatesError={pickerErrorMessage}
        isSubmitting={createList.isPending}
        onSubmit={handleAddContacts}
      />

      <ImportRecipientListFileModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        organizationId={organizationId}
      />

      <AlertDialog
        open={listPendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setListPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("whatsappTemplates.recipientLists.deleteConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("whatsappTemplates.recipientLists.deleteConfirm.description", {
                name: listPendingDelete?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteList.isPending} className="disabled:opacity-50">
              {t("whatsappTemplates.recipientLists.deleteConfirm.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteList.isPending}
              onClick={(ev) => {
                ev.preventDefault();
                void confirmDeleteList();
              }}
            >
              {deleteList.isPending
                ? t("whatsappTemplates.recipientLists.deleteConfirm.deleting")
                : t("whatsappTemplates.recipientLists.deleteConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-1 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
                  {showOwnerGate ? (
                    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card p-6 shadow-sm">
                      <p className="text-sm font-medium text-foreground">
                        {t("whatsappTemplates.recipientLists.ownerOnly.title")}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t("whatsappTemplates.recipientLists.ownerOnly.body")}
                      </p>
                    </div>
                  ) : (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                      <div className="mb-2 flex-shrink-0">
                        <RecipientListsToolbar
                          search={search}
                          onSearchChange={setSearch}
                          status={status}
                          onStatusChange={setStatus}
                          source={source}
                          onSourceChange={setSource}
                          onCreateUploadFile={onCreateUploadFile}
                          onCreateSelectContacts={onCreateSelectContacts}
                        />
                      </div>

                      <div className="flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
                        <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                          <RecipientListsTable
                            rows={sortedRows}
                            isLoading={pagePending}
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSortChange={onSortChange}
                            page={page}
                            pageSize={pageSize}
                            onPageChange={setPage}
                            onPageSizeChange={setPageSize}
                            onRequestDeleteList={onRequestDeleteList}
                            onRequestViewDetails={onRequestViewDetails}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
