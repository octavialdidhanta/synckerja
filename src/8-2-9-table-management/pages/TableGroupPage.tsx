import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/use-toast";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import { TableManagementModuleShell } from "../layout/TableManagementModuleShell";
import { TableGroupToolbar } from "../components/group/TableGroupToolbar";
import { TableGroupsTable } from "../components/group/TableGroupsTable";
import { TableGroupFormSheet } from "../components/group/TableGroupFormSheet";
import { usePosTableGroups } from "../hooks/usePosTableGroups";
import type { PosTableGroup } from "../lib/posTableGroupTypes";

export default function TableGroupPage() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { selectedOutletId, setSelectedOutletId, isLoading: outletsLoading } =
    useSelectedPosOutlet(true);

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PosTableGroup | null>(null);

  const {
    groups,
    isLoading,
    isError,
    error,
    refetch,
    create,
    update,
    softDelete,
    duplicate,
  } = usePosTableGroups(selectedOutletId || null);

  const showContent = useDebouncedReady(
    !(orgBootstrapPending || outletsLoading || (Boolean(selectedOutletId) && isLoading)),
    200,
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  const busy =
    create.isPending || update.isPending || softDelete.isPending || duplicate.isPending;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (group: PosTableGroup) => {
    setEditing(group);
    setFormOpen(true);
  };

  const handleSave = async (payload: { name: string; is_active: boolean }) => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
        toast({ title: t("tableManagement.group.saved", "Table group saved.") });
      } else {
        await create.mutateAsync(payload);
        toast({ title: t("tableManagement.group.created", "Table group created.") });
      }
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      toast({
        title: t("tableManagement.group.saveError", "Failed to save table group."),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    try {
      await softDelete.mutateAsync(editing.id);
      toast({ title: t("tableManagement.group.deleted", "Table group deleted.") });
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      toast({
        title: t("tableManagement.group.deleteError", "Failed to delete table group."),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const handleDuplicate = async (group: PosTableGroup) => {
    try {
      await duplicate.mutateAsync(group);
      toast({ title: t("tableManagement.group.duplicated", "Table group duplicated.") });
    } catch (err) {
      toast({
        title: t("tableManagement.group.duplicateError", "Failed to duplicate table group."),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <TableManagementModuleShell showContent={showContent}>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex-shrink-0 space-y-3 border-b px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">
                {t("tableManagement.group.title", "Table Group")}
              </h2>
              <Button type="button" onClick={openCreate} disabled={!selectedOutletId}>
                {t("tableManagement.group.create", "Create Table Group")}
              </Button>
            </div>
            <TableGroupToolbar
              outletId={selectedOutletId}
              onOutletChange={setSelectedOutletId}
              search={search}
              onSearchChange={setSearch}
            />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
            {isError ? (
              <Alert variant="destructive" className="mb-3">
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {error instanceof Error
                      ? error.message
                      : t("tableManagement.group.loadError", "Failed to load table groups.")}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => void refetch()}>
                    {t("common.retry", "Retry")}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
            {!selectedOutletId ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t("tableManagement.group.pickOutlet", "Select an outlet to manage table groups.")}
              </p>
            ) : (
              <TableGroupsTable
                groups={filtered}
                onSelect={openEdit}
                onDuplicate={(g) => void handleDuplicate(g)}
                duplicatingId={duplicate.isPending ? duplicate.variables?.id : null}
              />
            )}
          </div>
        </div>
      </div>
      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />

      <TableGroupFormSheet
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        group={editing}
        busy={busy}
        onSave={handleSave}
        onDelete={editing ? () => void handleDelete() : undefined}
      />
    </TableManagementModuleShell>
  );
}
