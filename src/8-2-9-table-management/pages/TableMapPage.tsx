import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/use-toast";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import { Link, useSearchParams } from "react-router-dom";
import { TableManagementModuleShell } from "../layout/TableManagementModuleShell";
import { TABLE_MANAGEMENT_GROUP_PATH } from "../layout/tableManagementTabs";
import { TableMapToolbar } from "../components/map/TableMapToolbar";
import { TableMapCanvas } from "../components/map/TableMapCanvas";
import {
  AddEditTableDialog,
  type TableDialogValues,
} from "../components/map/AddEditTableDialog";
import { usePosTableGroups } from "../hooks/usePosTableGroups";
import { usePosTables } from "../hooks/usePosTables";
import type { PosTable } from "../lib/posTableTypes";
import {
  applyTableRotation,
  axisAlignedFootprint,
  nextRotation,
  normalizeRotation,
} from "../lib/tableRotation";
import {
  findFirstFreeCell,
  footprintForShape,
  normalizePaxForShape,
} from "../lib/tableShapeLayout";

function cloneTables(rows: PosTable[]): PosTable[] {
  return rows.map((r) => ({ ...r, isNew: false }));
}

function tablesEqual(a: PosTable[], b: PosTable[]): boolean {
  if (a.length !== b.length) return false;
  const key = (t: PosTable) =>
    `${t.id}|${t.name}|${t.shape}|${t.pax}|${t.grid_x}|${t.grid_y}|${t.grid_w}|${t.grid_h}|${t.rotation}|${t.isNew ? 1 : 0}`;
  const sa = [...a].map(key).sort().join(";");
  const sb = [...b].map(key).sort().join(";");
  return sa === sb;
}

export default function TableMapPage() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { selectedOutletId, setSelectedOutletId, isLoading: outletsLoading } =
    useSelectedPosOutlet(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const { groups, isLoading: groupsLoading } = usePosTableGroups(selectedOutletId || null);
  const groupFromUrl = searchParams.get("group");
  const selectedGroupId = useMemo(() => {
    if (groupFromUrl && groups.some((g) => g.id === groupFromUrl)) return groupFromUrl;
    return groups[0]?.id ?? "";
  }, [groupFromUrl, groups]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  const {
    tables: serverTables,
    isLoading: tablesLoading,
    isError,
    error,
    refetch,
    saveBatch,
  } = usePosTables(selectedGroupId || null);

  const [draft, setDraft] = useState<PosTable[]>([]);
  const [baseline, setBaseline] = useState<PosTable[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editing, setEditing] = useState<PosTable | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const skipClickRef = useRef(false);

  useEffect(() => {
    if (!selectedOutletId || groupsLoading) return;
    if (groups.length === 0) {
      if (groupFromUrl) {
        const next = new URLSearchParams(searchParams);
        next.delete("group");
        setSearchParams(next, { replace: true });
      }
      return;
    }
    if (!groupFromUrl || !groups.some((g) => g.id === groupFromUrl)) {
      const next = new URLSearchParams(searchParams);
      next.set("group", groups[0]!.id);
      setSearchParams(next, { replace: true });
    }
  }, [
    groupFromUrl,
    groups,
    groupsLoading,
    searchParams,
    selectedOutletId,
    setSearchParams,
  ]);

  useEffect(() => {
    if (tablesLoading) return;
    const cloned = cloneTables(serverTables);
    setDraft(cloned);
    setBaseline(cloned);
    setDeletedIds([]);
    setSelectedId(null);
  }, [serverTables, tablesLoading, selectedGroupId]);

  const dirty = useMemo(() => {
    if (deletedIds.length > 0) return true;
    return !tablesEqual(draft, baseline);
  }, [baseline, deletedIds, draft]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const showContent = useDebouncedReady(
    !(
      orgBootstrapPending ||
      outletsLoading ||
      groupsLoading ||
      (Boolean(selectedGroupId) && tablesLoading)
    ),
    200,
  );

  const setGroupId = (id: string) => {
    if (dirty && !window.confirm(t("tableManagement.map.discardConfirm", "Discard unsaved changes?"))) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("group", id);
    setSearchParams(next, { replace: true });
  };

  const handleOutletChange = (id: string) => {
    if (dirty && !window.confirm(t("tableManagement.map.discardConfirm", "Discard unsaved changes?"))) {
      return;
    }
    setSelectedOutletId(id);
  };

  const openAdd = () => {
    setDialogMode("add");
    setEditing(null);
    setDialogOpen(true);
  };

  const handleSelect = (table: PosTable) => {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    setSelectedId(table.id);
  };

  const openEdit = (table: PosTable) => {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    setDialogMode("edit");
    setEditing(table);
    setSelectedId(table.id);
    setDialogOpen(true);
  };

  const handleRotate = useCallback(
    (table: PosTable) => {
      const toRot = nextRotation(normalizeRotation(table.rotation));
      const result = applyTableRotation(table, toRot, draft);
      if (!result.ok) {
        toast({
          title: t("tableManagement.map.overlap", "Cannot place table over another table."),
          variant: "destructive",
        });
        return;
      }
      setDraft((prev) =>
        prev.map((row) =>
          row.id === table.id
            ? {
                ...row,
                rotation: result.table.rotation,
                grid_w: result.table.grid_w,
                grid_h: result.table.grid_h,
              }
            : row,
        ),
      );
      setSelectedId(table.id);
    },
    [draft, t, toast],
  );

  const handleDialogSubmit = (values: TableDialogValues) => {
    const pax = normalizePaxForShape(values.shape, values.pax);
    const fp = footprintForShape(values.shape, pax);
    const rotation = normalizeRotation(values.rotation);

    if (dialogMode === "edit" && editing) {
      const candidate = {
        ...editing,
        name: values.name,
        shape: values.shape,
        pax,
        grid_w: fp.grid_w,
        grid_h: fp.grid_h,
        rotation: 0 as const,
      };
      const rotated = applyTableRotation(candidate, rotation, draft);
      if (!rotated.ok) {
        toast({
          title: t("tableManagement.map.overlap", "Cannot place table over another table."),
          variant: "destructive",
        });
        return;
      }
      setDraft((prev) =>
        prev.map((row) =>
          row.id === editing.id
            ? {
                ...row,
                name: values.name,
                shape: values.shape,
                pax,
                grid_w: rotated.table.grid_w,
                grid_h: rotated.table.grid_h,
                rotation: rotated.table.rotation,
              }
            : row,
        ),
      );
    } else {
      const occupied = draft.map((row) => {
        const a = axisAlignedFootprint(row);
        return {
          id: row.id,
          grid_x: row.grid_x,
          grid_y: row.grid_y,
          grid_w: a.grid_w,
          grid_h: a.grid_h,
        };
      });
      const placeFp =
        rotation === 90 || rotation === 270
          ? { grid_w: fp.grid_h, grid_h: fp.grid_w }
          : fp;
      const pos = findFirstFreeCell(occupied, placeFp);
      const id = crypto.randomUUID();
      setDraft((prev) => [
        ...prev,
        {
          id,
          organization_id: "",
          outlet_id: selectedOutletId,
          group_id: selectedGroupId,
          name: values.name,
          shape: values.shape,
          pax,
          grid_x: pos.grid_x,
          grid_y: pos.grid_y,
          grid_w: placeFp.grid_w,
          grid_h: placeFp.grid_h,
          rotation,
          is_deleted: false,
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          isNew: true,
        },
      ]);
      setSelectedId(id);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const handleDeleteFromDialog = () => {
    if (!editing) return;
    if (!editing.isNew) {
      setDeletedIds((prev) => (prev.includes(editing.id) ? prev : [...prev, editing.id]));
    }
    setDraft((prev) => prev.filter((t) => t.id !== editing.id));
    setDialogOpen(false);
    setEditing(null);
    setSelectedId(null);
  };

  const handleMove = useCallback((id: string, grid_x: number, grid_y: number) => {
    skipClickRef.current = true;
    setDraft((prev) =>
      prev.map((row) => (row.id === id ? { ...row, grid_x, grid_y } : row)),
    );
  }, []);

  const handleSave = async () => {
    if (!selectedOutletId || !selectedGroupId) return;
    try {
      await saveBatch.mutateAsync({
        outletId: selectedOutletId,
        groupId: selectedGroupId,
        tables: draft,
        deletedIds,
      });
      toast({ title: t("tableManagement.map.saved", "Table map saved.") });
      await refetch();
    } catch (err) {
      toast({
        title: t("tableManagement.map.saveError", "Failed to save table map."),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <TableManagementModuleShell showContent={showContent}>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex-shrink-0 border-b px-4 py-3">
            <TableMapToolbar
              outletId={selectedOutletId}
              onOutletChange={handleOutletChange}
              groups={groups}
              groupId={selectedGroupId}
              onGroupChange={setGroupId}
              groupsLoading={groupsLoading}
              onAddTable={openAdd}
              onSave={() => void handleSave()}
              saveDisabled={!dirty || !selectedGroupId}
              saving={saveBatch.isPending}
              groupActive={selectedGroup?.is_active ?? null}
            />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
            {isError ? (
              <Alert variant="destructive" className="mb-3">
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {error instanceof Error
                      ? error.message
                      : t("tableManagement.map.loadError", "Failed to load tables.")}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => void refetch()}>
                    {t("common.retry", "Retry")}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            {!selectedOutletId ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t("tableManagement.map.pickOutlet", "Select an outlet to edit the table map.")}
              </p>
            ) : groups.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {t(
                    "tableManagement.map.needGroup",
                    "Create a table group first, then arrange tables on the map.",
                  )}
                </p>
                <Link
                  to={TABLE_MANAGEMENT_GROUP_PATH}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t("tableManagement.map.backToGroup", "Go to Table Group")}
                </Link>
              </div>
            ) : (
              <TableMapCanvas
                tables={draft}
                selectedId={selectedId}
                dialogOpen={dialogOpen}
                onSelect={handleSelect}
                onEdit={openEdit}
                onMove={handleMove}
                onRotate={handleRotate}
              />
            )}
          </div>
        </div>
      </div>
      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />

      <AddEditTableDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        mode={dialogMode}
        initial={
          editing
            ? {
                name: editing.name,
                shape: editing.shape,
                pax: editing.pax,
                rotation: editing.rotation,
              }
            : null
        }
        onSubmit={handleDialogSubmit}
        onDelete={dialogMode === "edit" ? handleDeleteFromDialog : undefined}
      />
    </TableManagementModuleShell>
  );
}
