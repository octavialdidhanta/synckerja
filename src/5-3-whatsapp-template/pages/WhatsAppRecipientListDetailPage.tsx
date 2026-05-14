import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { useToast } from "@/shared/hooks/use-toast";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import {
  useActiveOrgOwnerRpc,
  useDeleteWhatsappRecipientList,
  useWhatsappRecipientListDetail,
} from "@/5-3-whatsapp-template/hooks/useWhatsappRecipientLists";
import type { RecipientSource, RecipientUploadStatus } from "@/5-3-whatsapp-template/components/recipient-lists/mockRecipientListsData";
import "@/2-1-employees/section/EmployeeTable.css";

function uploadStatusBadgeClass(status: string): string {
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

/**
 * `/omnichannel/campaign/recipient-lists/:listId` — detail + members (owner-only RLS).
 */
export function WhatsAppRecipientListDetailPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { listId } = useParams<{ listId: string }>();
  const { organizationId } = useCurrentOrg();
  const { data: ownerOk, isLoading: ownerLoading, isError: ownerRpcError } = useActiveOrgOwnerRpc(organizationId);
  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    error: detailQueryError,
    isFetched,
    refetch,
  } = useWhatsappRecipientListDetail(organizationId, listId);
  const deleteList = useDeleteWhatsappRecipientList(organizationId);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const list = detail?.list;
  const members = detail?.members ?? [];
  const memberTotal = detail?.memberTotal ?? 0;

  const uploadStatus = (list?.upload_status ?? "completed") as RecipientUploadStatus;
  const sourceKey: RecipientSource = list?.creation_source === "file_upload" ? "file_upload" : "contacts";

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

  const labelSource = useCallback(
    (s: RecipientSource) =>
      s === "file_upload" ? t("whatsappTemplates.recipientLists.source.fileUpload") : t("whatsappTemplates.recipientLists.source.contacts"),
    [t],
  );

  const channelLabel = useMemo(() => {
    const c = (list?.channel ?? "whatsapp").toLowerCase();
    return c === "whatsapp" ? "WhatsApp" : list?.channel ?? "—";
  }, [list?.channel]);

  const createdAtFormatted = useMemo(() => {
    if (!list?.created_at) return "—";
    try {
      return new Date(list.created_at).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  }, [list?.created_at]);

  const stats = useMemo(() => {
    const total = memberTotal;
    const failed = uploadStatus === "failed" ? total : 0;
    const uploaded = uploadStatus === "failed" ? 0 : total;
    return { total, uploaded, failed };
  }, [memberTotal, uploadStatus]);

  const memberRowStatus = uploadStatus === "failed" ? "failed" : "uploaded";

  const confirmDelete = useCallback(async () => {
    if (!listId || !list) return;
    try {
      await deleteList.mutateAsync(listId);
      toast({
        title: t("whatsappTemplates.recipientLists.toast.listDeletedTitle"),
        description: t("whatsappTemplates.recipientLists.toast.listDeletedDescription", { name: list.name }),
      });
      navigate("/omnichannel/campaign/recipient-lists", { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        variant: "destructive",
        title: t("whatsappTemplates.recipientLists.toast.deleteFailedTitle"),
        description: msg,
      });
    } finally {
      setDeleteOpen(false);
    }
  }, [deleteList, list, listId, navigate, t, toast]);

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
  const detailAwait = Boolean(organizationId && listId && ownerOk !== false);
  const pagePending =
    (Boolean(organizationId) && ownerLoading) ||
    !organizationId ||
    !listId ||
    (detailAwait && detailLoading && !detail && !detailError);

  const notFound = Boolean(organizationId && listId) && isFetched && !detailLoading && detail === null && !detailError;
  const showLoadError = detailAwait && !ownerLoading && detailError && !detail;

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("whatsappTemplates.recipientLists.deleteConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("whatsappTemplates.recipientLists.deleteConfirm.description", { name: list?.name ?? "" })}
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
                void confirmDelete();
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
                    <div className="flex w-full min-w-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card p-6 shadow-sm">
                      <p className="text-sm font-medium text-foreground">{t("whatsappTemplates.recipientLists.ownerOnly.title")}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{t("whatsappTemplates.recipientLists.ownerOnly.body")}</p>
                    </div>
                    </div>
                  ) : notFound ? (
                    <div className="flex w-full min-w-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card p-6 shadow-sm">
                      <p className="text-sm font-medium text-foreground">{t("whatsappTemplates.recipientListDetail.notFoundTitle")}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{t("whatsappTemplates.recipientListDetail.notFoundBody")}</p>
                      <Button type="button" variant="outline" className="mt-4 w-fit" onClick={() => navigate("/omnichannel/campaign/recipient-lists")}>
                        {t("whatsappTemplates.recipientListDetail.backToLists")}
                      </Button>
                    </div>
                    </div>
                  ) : showLoadError ? (
                    <div className="flex w-full min-w-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-destructive/30 bg-destructive/5 p-6 shadow-sm">
                      <p className="text-sm font-medium text-destructive">{t("whatsappTemplates.recipientListDetail.loadErrorTitle")}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {detailQueryError instanceof Error ? detailQueryError.message : String(detailQueryError ?? "")}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => void refetch()}>
                          {t("whatsappTemplates.recipientListDetail.retry")}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => navigate("/omnichannel/campaign/recipient-lists")}>
                          {t("whatsappTemplates.recipientListDetail.backToLists")}
                        </Button>
                      </div>
                    </div>
                    </div>
                  ) : (
                    <div className="flex w-full min-w-0 flex-1 flex-col">
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
                      {pagePending ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 pb-4">
                            <Skeleton className="h-8 w-44 shrink-0" />
                            <Skeleton className="h-3.5 w-36 shrink-0" />
                            <Skeleton className="h-3.5 min-w-[4rem] max-w-xs flex-1" />
                          </div>
                          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11.5rem,1fr))]">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                          </div>
                          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
                            <Skeleton className="h-14 w-full" />
                            <Skeleton className="h-14 w-full" />
                            <Skeleton className="h-14 w-full" />
                          </div>
                          <Skeleton className="h-64 w-full rounded-lg" />
                        </div>
                      ) : (
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
                          <div className="flex flex-shrink-0 flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="-ml-1.5 h-8 shrink-0 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                                onClick={() => navigate("/omnichannel/campaign/recipient-lists")}
                              >
                                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                                {t("whatsappTemplates.recipientListDetail.backToLists")}
                              </Button>
                              <p className="shrink-0 self-center text-xs font-medium uppercase leading-none tracking-wide text-muted-foreground">
                                {t("whatsappTemplates.recipientListDetail.kicker")}
                              </p>
                              <h1
                                className="min-w-0 flex-1 basis-0 self-center truncate text-xs font-medium uppercase leading-none tracking-wide text-foreground"
                                title={list?.name}
                              >
                                {list?.name}
                              </h1>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteOpen(true)}
                            >
                              {t("whatsappTemplates.recipientListDetail.deleteList")}
                            </Button>
                          </div>

                          <div className="grid w-full min-w-0 [grid-template-columns:repeat(auto-fit,minmax(11.5rem,1fr))] gap-3">
                            <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
                              <p className="text-xs font-medium text-muted-foreground">{t("whatsappTemplates.recipientListDetail.meta.uploadStatus")}</p>
                              <div className="mt-2">
                                <Badge className={`${uploadStatusBadgeClass(uploadStatus)} border px-2 py-1 text-xs`}>
                                  {labelStatus(uploadStatus)}
                                </Badge>
                              </div>
                            </div>
                            <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
                              <p className="text-xs font-medium text-muted-foreground">{t("whatsappTemplates.recipientListDetail.meta.createdAt")}</p>
                              <p className="mt-2 break-words text-sm font-medium text-foreground">{createdAtFormatted}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{t("whatsappTemplates.recipientListDetail.createdAtTimezoneNote")}</p>
                            </div>
                            <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
                              <p className="text-xs font-medium text-muted-foreground">{t("whatsappTemplates.recipientListDetail.meta.channel")}</p>
                              <p className="mt-2 text-sm font-medium text-foreground">{channelLabel}</p>
                            </div>
                            <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
                              <p className="text-xs font-medium text-muted-foreground">{t("whatsappTemplates.recipientListDetail.meta.source")}</p>
                              <p className="mt-2 text-sm font-medium text-foreground">{labelSource(sourceKey)}</p>
                            </div>
                          </div>

                          <div className="grid w-full min-w-0 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))] gap-3">
                            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-center">
                              <p className="text-2xl font-semibold tabular-nums text-foreground">{stats.total.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{t("whatsappTemplates.recipientListDetail.stats.total")}</p>
                            </div>
                            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-center">
                              <p className="text-2xl font-semibold tabular-nums text-foreground">{stats.uploaded.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{t("whatsappTemplates.recipientListDetail.stats.uploaded")}</p>
                            </div>
                            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-center">
                              <p className="text-2xl font-semibold tabular-nums text-foreground">{stats.failed.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{t("whatsappTemplates.recipientListDetail.stats.failed")}</p>
                            </div>
                          </div>

                          <div className="flex min-h-[min(28rem,50vh)] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-muted/20">
                            <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto p-2">
                              <table className="employee-table w-full caption-bottom text-sm">
                                <TableHeader className="sticky top-0 z-20 bg-gray-50 shadow-sm">
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700">
                                      {t("whatsappTemplates.recipientListDetail.col.fullName")}
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700">
                                      {t("whatsappTemplates.recipientListDetail.col.phone")}
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap bg-gray-50 px-3 text-xs font-medium text-gray-700">
                                      {t("whatsappTemplates.recipientListDetail.col.status")}
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {members.length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                                        {t("whatsappTemplates.recipientListDetail.membersEmpty")}
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    members.map((m) => (
                                      <TableRow key={m.id} className="h-12 transition-colors hover:bg-gray-50/50">
                                        <TableCell className="px-3 text-sm text-gray-900">{m.fullName}</TableCell>
                                        <TableCell className="px-3 font-mono text-sm text-gray-900">{m.phoneDisplay}</TableCell>
                                        <TableCell className="px-3">
                                          {memberRowStatus === "uploaded" ? (
                                            <Badge className="border border-green-200 bg-green-100 px-2 py-1 text-xs text-green-800">
                                              {t("whatsappTemplates.recipientListDetail.memberStatus.uploaded")}
                                            </Badge>
                                          ) : (
                                            <Badge className="border border-red-200 bg-red-100 px-2 py-1 text-xs text-red-800">
                                              {t("whatsappTemplates.recipientListDetail.memberStatus.failed")}
                                            </Badge>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
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
