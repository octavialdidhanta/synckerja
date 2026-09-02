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
import {
  TableMapCanvas,
  type MapSelectionKind,
} from "../components/map/TableMapCanvas";
import {
  AddEditTableDialog,
  type TableDialogValues,
} from "../components/map/AddEditTableDialog";
import {
  AddFloorFixtureDialog,
  type FloorFixtureDialogValues,
} from "../fixtures/components/AddFloorFixtureDialog";
import { usePosTableGroups } from "../hooks/usePosTableGroups";
import { usePosTables } from "../hooks/usePosTables";
import { usePosFloorFixtures } from "../fixtures/hooks/usePosFloorFixtures";
import type { PosTable } from "../lib/posTableTypes";
import type {
  PosFloorFixture,
  PosFloorFixtureType,
} from "../fixtures/lib/posFloorFixtureTypes";
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
import {
  applyFixtureRotation,
  defaultFootprintForType,
  findFixtureFreeCell,
  isEdgeStripFixtureType,
  isFixedCellFixtureType,
  normalizeEdgeStripFootprint,
  normalizeFixedCellFootprint,
} from "../fixtures/lib/fixtureLayout";
import type { FixtureRect } from "../fixtures/lib/fixtureLayout";
import { nextFixtureName } from "../fixtures/lib/fixtureNaming";
import {
  fixtureTypeFallback,
  fixtureTypeLabelKey,
} from "../fixtures/lib/fixtureVisuals";
import {
  findPasteCell,
  nextUniqueMapName,
  type MapClipboardItem,
} from "../lib/mapClipboard";

function cloneTables(rows: PosTable[]): PosTable[] {
  return rows.map((r) => ({ ...r, isNew: false }));
}

function cloneFixtures(rows: PosFloorFixture[]): PosFloorFixture[] {
  return rows.map((r) => ({ ...r, isNew: false }));
}

function tablesEqual(a: PosTable[], b: PosTable[]): boolean {
  if (a.length !== b.length) return false;
  const key = (t: PosTable) =>
    `${t.id}|${t.name}|${t.shape}|${t.pax}|${t.grid_x}|${t.grid_y}|${t.grid_w}|${t.grid_h}|${t.rotation}|${t.isNew ? 1 : 0}`;
  return [...a].map(key).sort().join(";") === [...b].map(key).sort().join(";");
}

function fixturesEqual(a: PosFloorFixture[], b: PosFloorFixture[]): boolean {
  if (a.length !== b.length) return false;
  const key = (f: PosFloorFixture) =>
    `${f.id}|${f.fixture_type}|${f.name}|${f.grid_x}|${f.grid_y}|${f.grid_w}|${f.grid_h}|${f.rotation}|${f.isNew ? 1 : 0}`;
  return [...a].map(key).sort().join(";") === [...b].map(key).sort().join(";");
}

function occupancyFromDrafts(
  tables: PosTable[],
  fixtures: PosFloorFixture[],
) {
  return [
    ...tables.map((row) => {
      const a = axisAlignedFootprint(row);
      return {
        id: row.id,
        grid_x: row.grid_x,
        grid_y: row.grid_y,
        grid_w: a.grid_w,
        grid_h: a.grid_h,
      };
    }),
    ...fixtures.map((f) => ({
      id: f.id,
      grid_x: f.grid_x,
      grid_y: f.grid_y,
      grid_w: f.grid_w,
      grid_h: f.grid_h,
    })),
  ];
}

export default function TableMapPage() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { selectedOutletId, setSelectedOutletId, isLoading: outletsLoading } =
    useSelectedPosOutlet(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const { groups, isLoading: groupsLoading } = usePosTableGroups(
    selectedOutletId || null,
  );
  const groupFromUrl = searchParams.get("group");
  const selectedGroupId = useMemo(() => {
    if (groupFromUrl && groups.some((g) => g.id === groupFromUrl)) {
      return groupFromUrl;
    }
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

  const {
    fixtures: serverFixtures,
    isLoading: fixturesLoading,
    refetch: refetchFixtures,
    saveBatch: saveFixturesBatch,
  } = usePosFloorFixtures(selectedGroupId || null);

  const [draft, setDraft] = useState<PosTable[]>([]);
  const [baseline, setBaseline] = useState<PosTable[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [draftFixtures, setDraftFixtures] = useState<PosFloorFixture[]>([]);
  const [baselineFixtures, setBaselineFixtures] = useState<PosFloorFixture[]>(
    [],
  );
  const [deletedFixtureIds, setDeletedFixtureIds] = useState<string[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editing, setEditing] = useState<PosTable | null>(null);

  const [fixtureDialogOpen, setFixtureDialogOpen] = useState(false);
  const [fixtureDialogMode, setFixtureDialogMode] = useState<"add" | "edit">(
    "add",
  );
  const [editingFixture, setEditingFixture] = useState<PosFloorFixture | null>(
    null,
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<MapSelectionKind | null>(
    null,
  );
  const [clipboard, setClipboard] = useState<MapClipboardItem | null>(null);
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
    if (tablesLoading || fixturesLoading) return;
    const cloned = cloneTables(serverTables);
    setDraft(cloned);
    setBaseline(cloned);
    setDeletedIds([]);
    const clonedF = cloneFixtures(serverFixtures);
    setDraftFixtures(clonedF);
    setBaselineFixtures(clonedF);
    setDeletedFixtureIds([]);
    setSelectedId(null);
    setSelectedKind(null);
    setClipboard(null);
  }, [
    serverTables,
    serverFixtures,
    tablesLoading,
    fixturesLoading,
    selectedGroupId,
  ]);

  const dirty = useMemo(() => {
    if (deletedIds.length > 0 || deletedFixtureIds.length > 0) return true;
    return (
      !tablesEqual(draft, baseline) ||
      !fixturesEqual(draftFixtures, baselineFixtures)
    );
  }, [
    baseline,
    baselineFixtures,
    deletedFixtureIds,
    deletedIds,
    draft,
    draftFixtures,
  ]);

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
      (Boolean(selectedGroupId) && (tablesLoading || fixturesLoading))
    ),
    200,
  );

  const setGroupId = (id: string) => {
    if (
      dirty &&
      !window.confirm(
        t("tableManagement.map.discardConfirm", "Discard unsaved changes?"),
      )
    ) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("group", id);
    setSearchParams(next, { replace: true });
  };

  const handleOutletChange = (id: string) => {
    if (
      dirty &&
      !window.confirm(
        t("tableManagement.map.discardConfirm", "Discard unsaved changes?"),
      )
    ) {
      return;
    }
    setSelectedOutletId(id);
  };

  const openAdd = () => {
    setDialogMode("add");
    setEditing(null);
    setDialogOpen(true);
  };

  const suggestFixtureName = useCallback(
    (type: PosFloorFixtureType) => {
      const label = t(fixtureTypeLabelKey(type), fixtureTypeFallback(type));
      return nextFixtureName(
        type,
        draftFixtures.map((f) => f.name),
        label,
      );
    },
    [draftFixtures, t],
  );

  const openAddFixture = () => {
    setFixtureDialogMode("add");
    setEditingFixture(null);
    setFixtureDialogOpen(true);
  };

  const handleSelectTable = (table: PosTable) => {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    setSelectedId(table.id);
    setSelectedKind("table");
  };

  const handleSelectFixture = (fixture: PosFloorFixture) => {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    setSelectedId(fixture.id);
    setSelectedKind("fixture");
  };

  const handleCopy = useCallback(() => {
    if (selectedKind === "table") {
      const row = draft.find((t) => t.id === selectedId);
      if (!row) {
        toast({
          title: t(
            "tableManagement.map.copyEmpty",
            "Select a table or floor item to copy.",
          ),
        });
        return;
      }
      setClipboard({ kind: "table", source: { ...row } });
      toast({ title: t("tableManagement.map.copied", "Copied.") });
      return;
    }
    if (selectedKind === "fixture") {
      const row = draftFixtures.find((f) => f.id === selectedId);
      if (!row) {
        toast({
          title: t(
            "tableManagement.map.copyEmpty",
            "Select a table or floor item to copy.",
          ),
        });
        return;
      }
      setClipboard({ kind: "fixture", source: { ...row } });
      toast({ title: t("tableManagement.map.copied", "Copied.") });
      return;
    }
    toast({
      title: t(
        "tableManagement.map.copyEmpty",
        "Select a table or floor item to copy.",
      ),
    });
  }, [draft, draftFixtures, selectedId, selectedKind, t, toast]);

  const pasteFromClipboardItem = useCallback(
    (item: MapClipboardItem) => {
      if (!selectedOutletId || !selectedGroupId) return;
      const occupied = occupancyFromDrafts(draft, draftFixtures);
      const now = new Date().toISOString();
      if (item.kind === "table") {
        const src = item.source;
        const pos = findPasteCell(occupied, src, src);
        const id = crypto.randomUUID();
        setDraft((prev) => [
          ...prev,
          {
            ...src,
            id,
            name: nextUniqueMapName(
              src.name,
              prev.map((row) => row.name),
            ),
            outlet_id: selectedOutletId,
            group_id: selectedGroupId,
            grid_x: pos.grid_x,
            grid_y: pos.grid_y,
            is_deleted: false,
            deleted_at: null,
            created_at: now,
            updated_at: now,
            isNew: true,
          },
        ]);
        setSelectedId(id);
        setSelectedKind("table");
        return;
      }
      const src = item.source;
      const pos = findPasteCell(occupied, src, src);
      const id = crypto.randomUUID();
      setDraftFixtures((prev) => [
        ...prev,
        {
          ...src,
          id,
          name: nextUniqueMapName(
            src.name,
            prev.map((row) => row.name),
          ),
          outlet_id: selectedOutletId,
          group_id: selectedGroupId,
          grid_x: pos.grid_x,
          grid_y: pos.grid_y,
          is_deleted: false,
          deleted_at: null,
          created_at: now,
          updated_at: now,
          isNew: true,
        },
      ]);
      setSelectedId(id);
      setSelectedKind("fixture");
    },
    [draft, draftFixtures, selectedGroupId, selectedOutletId],
  );

  const handlePaste = useCallback(() => {
    if (!clipboard) {
      toast({
        title: t(
          "tableManagement.map.pasteEmpty",
          "Copy an item first, then paste.",
        ),
      });
      return;
    }
    pasteFromClipboardItem(clipboard);
    toast({ title: t("tableManagement.map.pasted", "Pasted.") });
  }, [clipboard, pasteFromClipboardItem, t, toast]);

  const handleDuplicate = useCallback(() => {
    let item: MapClipboardItem | null = null;
    if (selectedKind === "table") {
      const row = draft.find((t) => t.id === selectedId);
      if (row) item = { kind: "table", source: { ...row } };
    } else if (selectedKind === "fixture") {
      const row = draftFixtures.find((f) => f.id === selectedId);
      if (row) item = { kind: "fixture", source: { ...row } };
    }
    if (!item) {
      toast({
        title: t(
          "tableManagement.map.copyEmpty",
          "Select a table or floor item to copy.",
        ),
      });
      return;
    }
    setClipboard(item);
    pasteFromClipboardItem(item);
    toast({ title: t("tableManagement.map.pasted", "Pasted.") });
  }, [
    draft,
    draftFixtures,
    pasteFromClipboardItem,
    selectedId,
    selectedKind,
    t,
    toast,
  ]);

  const openEdit = (table: PosTable) => {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    setDialogMode("edit");
    setEditing(table);
    setSelectedId(table.id);
    setSelectedKind("table");
    setDialogOpen(true);
  };

  const openEditFixture = (fixture: PosFloorFixture) => {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    setFixtureDialogMode("edit");
    setEditingFixture(fixture);
    setSelectedId(fixture.id);
    setSelectedKind("fixture");
    setFixtureDialogOpen(true);
  };

  const handleRotateTable = useCallback(
    (table: PosTable) => {
      const toRot = nextRotation(normalizeRotation(table.rotation));
      const others = [
        ...draft,
        ...draftFixtures.map((f) => ({
          id: f.id,
          grid_x: f.grid_x,
          grid_y: f.grid_y,
          grid_w: f.grid_w,
          grid_h: f.grid_h,
          rotation: f.rotation,
        })),
      ];
      const result = applyTableRotation(table, toRot, others);
      if (!result.ok) {
        toast({
          title: t(
            "tableManagement.map.overlap",
            "Cannot place table over another table.",
          ),
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
      setSelectedKind("table");
    },
    [draft, draftFixtures, t, toast],
  );

  const handleRotateFixture = useCallback(
    (fixture: PosFloorFixture) => {
      const toRot = nextRotation(normalizeRotation(fixture.rotation));
      const occupied = occupancyFromDrafts(draft, draftFixtures);
      const result = applyFixtureRotation(fixture, toRot, occupied);
      if (!result.ok) {
        toast({
          title: t(
            "tableManagement.map.overlap",
            "Cannot place table over another table.",
          ),
          variant: "destructive",
        });
        return;
      }
      setDraftFixtures((prev) =>
        prev.map((row) => (row.id === fixture.id ? result.fixture : row)),
      );
      setSelectedId(fixture.id);
      setSelectedKind("fixture");
    },
    [draft, draftFixtures, t, toast],
  );

  const handleDialogSubmit = (values: TableDialogValues) => {
    const pax = normalizePaxForShape(values.shape, values.pax);
    const fp = footprintForShape(values.shape, pax);
    const rotation = normalizeRotation(values.rotation);
    const othersForRotate = [
      ...draft,
      ...draftFixtures.map((f) => ({
        id: f.id,
        grid_x: f.grid_x,
        grid_y: f.grid_y,
        grid_w: f.grid_w,
        grid_h: f.grid_h,
        rotation: f.rotation,
      })),
    ];

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
      const rotated = applyTableRotation(candidate, rotation, othersForRotate);
      if (!rotated.ok) {
        toast({
          title: t(
            "tableManagement.map.overlap",
            "Cannot place table over another table.",
          ),
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
      const occupied = occupancyFromDrafts(draft, draftFixtures);
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
      setSelectedKind("table");
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const handleFixtureDialogSubmit = (values: FloorFixtureDialogValues) => {
    const rotation =
      fixtureDialogMode === "edit" && editingFixture
        ? editingFixture.rotation
        : 0;
    const size = isFixedCellFixtureType(values.fixture_type)
      ? normalizeFixedCellFootprint()
      : isEdgeStripFixtureType(values.fixture_type)
      ? normalizeEdgeStripFootprint(values.grid_w, values.grid_h, rotation)
      : {
          grid_w: Math.max(1, values.grid_w),
          grid_h: Math.max(1, values.grid_h),
        };
    if (fixtureDialogMode === "edit" && editingFixture) {
      const occupied = occupancyFromDrafts(draft, draftFixtures).filter(
        (o) => o.id !== editingFixture.id,
      );
      const candidate = {
        x: editingFixture.grid_x,
        y: editingFixture.grid_y,
        w: size.grid_w,
        h: size.grid_h,
      };
      const clash = occupied.some(
        (o) =>
          !(
            candidate.x + candidate.w <= o.grid_x ||
            o.grid_x + o.grid_w <= candidate.x ||
            candidate.y + candidate.h <= o.grid_y ||
            o.grid_y + o.grid_h <= candidate.y
          ),
      );
      if (clash) {
        toast({
          title: t(
            "tableManagement.map.overlap",
            "Cannot place table over another table.",
          ),
          variant: "destructive",
        });
        return;
      }
      setDraftFixtures((prev) =>
        prev.map((row) =>
          row.id === editingFixture.id
            ? {
                ...row,
                name: values.name,
                grid_w: size.grid_w,
                grid_h: size.grid_h,
              }
            : row,
        ),
      );
    } else {
      const defaults = defaultFootprintForType(values.fixture_type);
      const fp = {
        grid_w: Math.max(1, size.grid_w || defaults.grid_w),
        grid_h: Math.max(1, size.grid_h || defaults.grid_h),
      };
      const occupied = occupancyFromDrafts(draft, draftFixtures);
      const pos = findFixtureFreeCell(occupied, fp);
      const id = crypto.randomUUID();
      setDraftFixtures((prev) => [
        ...prev,
        {
          id,
          organization_id: "",
          outlet_id: selectedOutletId,
          group_id: selectedGroupId,
          fixture_type: values.fixture_type,
          name: values.name,
          grid_x: pos.grid_x,
          grid_y: pos.grid_y,
          grid_w: fp.grid_w,
          grid_h: fp.grid_h,
          rotation: 0,
          is_deleted: false,
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          isNew: true,
        },
      ]);
      setSelectedId(id);
      setSelectedKind("fixture");
    }
    setFixtureDialogOpen(false);
    setEditingFixture(null);
  };

  const handleDeleteFromDialog = () => {
    if (!editing) return;
    if (!editing.isNew) {
      setDeletedIds((prev) =>
        prev.includes(editing.id) ? prev : [...prev, editing.id],
      );
    }
    setDraft((prev) => prev.filter((row) => row.id !== editing.id));
    setDialogOpen(false);
    setEditing(null);
    setSelectedId(null);
    setSelectedKind(null);
  };

  const handleDeleteFixture = () => {
    if (!editingFixture) return;
    if (
      !window.confirm(
        t(
          "tableManagement.fixture.deleteConfirm",
          "Remove this floor item from the map?",
        ),
      )
    ) {
      return;
    }
    if (!editingFixture.isNew) {
      setDeletedFixtureIds((prev) =>
        prev.includes(editingFixture.id)
          ? prev
          : [...prev, editingFixture.id],
      );
    }
    setDraftFixtures((prev) =>
      prev.filter((row) => row.id !== editingFixture.id),
    );
    setFixtureDialogOpen(false);
    setEditingFixture(null);
    setSelectedId(null);
    setSelectedKind(null);
  };

  const handleMoveTable = useCallback((id: string, grid_x: number, grid_y: number) => {
    skipClickRef.current = true;
    setDraft((prev) =>
      prev.map((row) => (row.id === id ? { ...row, grid_x, grid_y } : row)),
    );
  }, []);

  const handleMoveFixture = useCallback(
    (id: string, grid_x: number, grid_y: number) => {
      skipClickRef.current = true;
      setDraftFixtures((prev) =>
        prev.map((row) => (row.id === id ? { ...row, grid_x, grid_y } : row)),
      );
    },
    [],
  );

  const handleResizeFixture = useCallback(
    (fixture: PosFloorFixture, next: FixtureRect) => {
      const occupied = occupancyFromDrafts(draft, draftFixtures);
      const clash = occupied.some((o) => {
        if (o.id === fixture.id) return false;
        return !(
          next.grid_x + next.grid_w <= o.grid_x ||
          o.grid_x + o.grid_w <= next.grid_x ||
          next.grid_y + next.grid_h <= o.grid_y ||
          o.grid_y + o.grid_h <= next.grid_y
        );
      });
      if (clash) return;
      skipClickRef.current = true;
      setDraftFixtures((prev) =>
        prev.map((row) =>
          row.id === fixture.id
            ? {
                ...row,
                grid_x: next.grid_x,
                grid_y: next.grid_y,
                grid_w: next.grid_w,
                grid_h: next.grid_h,
              }
            : row,
        ),
      );
    },
    [draft, draftFixtures],
  );

  const handleSave = async () => {
    if (!selectedOutletId || !selectedGroupId) return;
    try {
      await saveBatch.mutateAsync({
        outletId: selectedOutletId,
        groupId: selectedGroupId,
        tables: draft,
        deletedIds,
      });
      await saveFixturesBatch.mutateAsync({
        outletId: selectedOutletId,
        groupId: selectedGroupId,
        fixtures: draftFixtures,
        deletedIds: deletedFixtureIds,
      });
      toast({ title: t("tableManagement.map.saved", "Table map saved.") });
      await Promise.all([refetch(), refetchFixtures()]);
    } catch (err) {
      toast({
        title: t("tableManagement.map.saveError", "Failed to save table map."),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const saving = saveBatch.isPending || saveFixturesBatch.isPending;
  const anyDialogOpen = dialogOpen || fixtureDialogOpen;

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
              onAddFloorItem={openAddFixture}
              onCopy={handleCopy}
              onPaste={handlePaste}
              canCopy={Boolean(selectedId && selectedKind)}
              canPaste={Boolean(clipboard)}
              onSave={() => void handleSave()}
              saveDisabled={!dirty || !selectedGroupId}
              saving={saving}
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
                      : t(
                          "tableManagement.map.loadError",
                          "Failed to load tables.",
                        )}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refetch()}
                  >
                    {t("common.retry", "Retry")}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            {!selectedOutletId ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t(
                  "tableManagement.map.pickOutlet",
                  "Select an outlet to edit the table map.",
                )}
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
                fixtures={draftFixtures}
                selectedId={selectedId}
                selectedKind={selectedKind}
                dialogOpen={anyDialogOpen}
                onSelectTable={handleSelectTable}
                onSelectFixture={handleSelectFixture}
                onEditTable={openEdit}
                onEditFixture={openEditFixture}
                onMoveTable={handleMoveTable}
                onMoveFixture={handleMoveFixture}
                onResizeFixture={handleResizeFixture}
                onRotateTable={handleRotateTable}
                onRotateFixture={handleRotateFixture}
                onCopy={handleCopy}
                onPaste={handlePaste}
                onDuplicate={handleDuplicate}
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

      <AddFloorFixtureDialog
        open={fixtureDialogOpen}
        onOpenChange={(open) => {
          setFixtureDialogOpen(open);
          if (!open) setEditingFixture(null);
        }}
        mode={fixtureDialogMode}
        initial={
          editingFixture
            ? {
                fixture_type: editingFixture.fixture_type,
                name: editingFixture.name,
                grid_w: editingFixture.grid_w,
                grid_h: editingFixture.grid_h,
              }
            : null
        }
        suggestName={suggestFixtureName}
        onSubmit={handleFixtureDialogSubmit}
        onDelete={
          fixtureDialogMode === "edit" ? handleDeleteFixture : undefined
        }
      />
    </TableManagementModuleShell>
  );
}
