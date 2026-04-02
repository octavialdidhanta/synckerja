import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, ClipboardList, Edit, Trash2 } from "lucide-react";
import { useDailyTaskReport } from "../context/ReportContext";
import { BlockerDetailsModal } from "./BlockerDetailsModal";
import { ReportMainFooter } from "./ReportMainFooter";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useToast } from "@/shared/components/ui/use-toast";
import { formatDateTime } from "@/shared/utils/dateFormatter";
import { cn } from "@/shared/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/shared/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";

function CellWithTooltip({ text, className }: { text: string; className?: string }) {
  const display = text || "-";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("line-clamp-2 break-words cursor-default max-w-full overflow-hidden text-ellipsis", className)}>{display}</div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm bg-white text-gray-900 border border-gray-200 shadow-lg">
        <p className="whitespace-pre-wrap">{display}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface ResolvedBlockerRow {
  id: string;
  task_step_history_id: string;
  taskTitle: string;
  stepTitle: string;
  subStepTitle: string | null;
  resolved_at: string;
  blocker_description: string;
  resolution_details: string;
  days_to_resolve: number;
  blocker_created_at: string;
}

export const PerformanceTable = () => {
  const { filtered: rows, loading, getBlockersForStep, filteredBlockers, filters, formatDateRangeDisplay } = useDailyTaskReport();
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();
  const [openForStep, setOpenForStep] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"performance" | "resolved">("performance");
  const [resolvedRows, setResolvedRows] = useState<ResolvedBlockerRow[]>([]);
  const [loadingResolved, setLoadingResolved] = useState(false);
  const [editingRow, setEditingRow] = useState<ResolvedBlockerRow | null>(null);
  const [editResolutionText, setEditResolutionText] = useState("");
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const resolvedBlockers = useMemo(() => (filteredBlockers || []).filter((b: any) => b.is_resolved), [filteredBlockers]);

  const getDateRangeForRPC = useCallback(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;
    if (filters.timePeriod === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (filters.timePeriod === "yesterday") {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate());
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
    } else if (filters.timePeriod === "this_week") {
      const day = now.getDay();
      const daysToMonday = day === 0 ? 6 : day - 1;
      start = new Date(now);
      start.setDate(now.getDate() - daysToMonday);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (filters.timePeriod === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (filters.timePeriod === "last_month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (filters.timePeriod === "custom" && filters.customStart && filters.customEnd) {
      start = new Date(filters.customStart);
      end = new Date(filters.customEnd);
      end.setHours(23, 59, 59, 999);
    }
    return { start: start ? start.toISOString() : null, end: end ? end.toISOString() : null };
  }, [filters.timePeriod, filters.customStart, filters.customEnd]);

  useEffect(() => {
    if (viewMode !== "resolved" || !organizationId) return;
    let isCancelled = false;
    const fetchResolvedDetails = async () => {
      setLoadingResolved(true);
      try {
        const { start, end } = getDateRangeForRPC();
        const { data: resolvedData, error } = await (supabase as any).rpc("get_all_resolved_blockers", {
          p_organization_id: organizationId,
          p_limit: 100,
          p_start_date: start,
          p_end_date: end,
        });
        if (isCancelled) return;
        if (error) {
          setResolvedRows([]);
          toast({ title: "Error", description: `Failed to load resolved blockers: ${error.message}`, variant: "destructive" });
          return;
        }
        const mapped: ResolvedBlockerRow[] = (resolvedData || []).map((row: any) => {
          const createdAt = new Date(row.blocker_created_at);
          const resolvedAt = new Date(row.resolved_at || row.blocker_created_at);
          const daysToResolve = Math.ceil((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: row.blocker_resolved_id || row.id,
            task_step_history_id: row.task_step_history_id || row.id,
            taskTitle: row.task_title || "-",
            stepTitle: row.step_title || "-",
            subStepTitle: row.sub_step_title,
            resolved_at: row.resolved_at || row.blocker_created_at,
            blocker_description: row.blocker_description || "-",
            resolution_details: row.resolution_description || "No resolution details provided",
            days_to_resolve: Math.max(0, daysToResolve),
            blocker_created_at: row.blocker_created_at,
          };
        });
        setResolvedRows(mapped);
      } catch {
        if (!isCancelled) {
          setResolvedRows([]);
          toast({ title: "Error", description: "An unexpected error occurred while loading resolved blockers", variant: "destructive" });
        }
      } finally {
        if (!isCancelled) setLoadingResolved(false);
      }
    };
    const timeoutId = setTimeout(() => void fetchResolvedDetails(), 300);
    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [viewMode, organizationId, filters.timePeriod, filters.customStart, filters.customEnd, getDateRangeForRPC, toast]);

  const handleSaveEdit = async () => {
    if (!editingRow || isSaving) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("task_step_history_blocker_resolved").update({ resolution_description: editResolutionText.trim() }).eq("id", editingRow.id);
      if (error) {
        toast({ title: "Error", description: `Failed to update resolution: ${error.message}`, variant: "destructive" });
        return;
      }
      setResolvedRows((prev) => prev.map((row) => (row.id === editingRow.id ? { ...row, resolution_details: editResolutionText.trim() } : row)));
      setEditingRow(null);
      setEditResolutionText("");
      toast({ title: "Success", description: "Resolution details updated successfully" });
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteResolution = async () => {
    if (!deletingRowId) return;
    setIsDeleting(true);
    try {
      const rowToDelete = resolvedRows.find((r) => r.id === deletingRowId);
      if (!rowToDelete) return;
      const { error: deleteResError } = await supabase.from("task_step_history_blocker_resolved").delete().eq("id", rowToDelete.id);
      if (deleteResError) {
        toast({ title: "Error", description: `Failed to delete resolution: ${deleteResError.message}`, variant: "destructive" });
        return;
      }
      await supabase.from("task_step_history").update({ is_resolved: false }).eq("id", rowToDelete.task_step_history_id);
      setResolvedRows((prev) => prev.filter((row) => row.id !== deletingRowId));
      setDeletingRowId(null);
      toast({ title: "Success", description: "Resolution deleted successfully" });
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const dateRangeDisplay = formatDateRangeDisplay();

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-white ring-1 ring-brand-blue/10">
      <div className="flex-shrink-0 border-b border-brand-blue/15 bg-brand-blue/[0.06] px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{viewMode === "performance" ? "Assignments Performance" : "Blocker Resolved"}</span>
          {viewMode === "performance" ? (
            <button onClick={() => setViewMode("resolved")} className="inline-flex items-center gap-1.5 rounded-md border border-brand-blue/30 bg-brand-blue/10 px-3 py-1 text-xs font-medium text-brand-blue transition-colors hover:bg-brand-blue/15">
              <CheckCircle className="w-3.5 h-3.5" />
              Blocker Resolved
              {resolvedBlockers.length > 0 && <span className="ml-1 rounded-full bg-brand-blue px-1.5 py-0.5 text-[10px] font-semibold text-white">{resolvedBlockers.length}</span>}
            </button>
          ) : (
            <button onClick={() => setViewMode("performance")} className="inline-flex items-center gap-1.5 rounded-md border border-brand-blue/30 bg-brand-blue/10 px-3 py-1 text-xs font-medium text-brand-blue transition-colors hover:bg-brand-blue/15">
              <ClipboardList className="w-3.5 h-3.5" />
              Assignments Performance
            </button>
          )}
        </div>
        {dateRangeDisplay && <div className="text-xs text-gray-500 mt-1">{dateRangeDisplay}</div>}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto seamless-scroll nested-scroll-touch-chain">
        {viewMode === "performance" ? (
          <table className="text-sm" style={{ minWidth: "100%", tableLayout: "auto" }}>
            <thead className="sticky top-0 z-20 bg-brand-blue/[0.06] text-gray-600 shadow-sm">
              <tr>
                <th className="bg-brand-blue/[0.06] px-3 py-2 text-left" style={{ width: "120px", minWidth: "120px" }}>PIC</th>
                <th className="bg-brand-blue/[0.06] px-3 py-2 text-left" style={{ minWidth: "150px" }}>Task</th>
                <th className="bg-brand-blue/[0.06] px-3 py-2 text-left" style={{ minWidth: "150px" }}>Step</th>
                <th className="bg-brand-blue/[0.06] px-3 py-2 text-left" style={{ minWidth: "150px" }}>Sub Step</th>
                <th className="bg-brand-blue/[0.06] px-3 py-2 text-left" style={{ width: "140px", minWidth: "140px" }}>Blocker</th>
                <th className="bg-brand-blue/[0.06] px-3 py-2 text-left" style={{ width: "140px", minWidth: "140px" }}>Assigned At</th>
                <th className="bg-brand-blue/[0.06] px-3 py-2 text-left" style={{ width: "100px", minWidth: "100px" }}>Due Date</th>
                <th className="bg-brand-blue/[0.06] px-3 py-2 text-left" style={{ width: "160px", minWidth: "160px" }}>Finished</th>
                <th className="bg-brand-blue/[0.06] px-3 py-2 text-left" style={{ width: "112px", minWidth: "112px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-500">No data</td></tr>
              ) : (
                rows.map((r, idx) => {
                  const stepBlockers = getBlockersForStep(r.stepId || "");
                  const items =
                    r.type === "substep" && (r as any).subStepId
                      ? stepBlockers.filter((b: any) => b.task_steps_to_steps_id === (r as any).subStepId)
                      : stepBlockers.filter((b: any) => !b.task_steps_to_steps_id || b.task_step_id === r.stepId);
                  const count = items.length;
                  const blockerLabel = count > 0 ? `Found ${count} Blocker${count > 1 ? "s" : ""}` : "-";
                  return (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2 text-left text-gray-900 align-top"><CellWithTooltip text={r.employeeName} /></td>
                      <td className="px-3 py-2 text-left text-gray-700 align-top"><CellWithTooltip text={r.taskTitle} /></td>
                      <td className="px-3 py-2 text-left text-gray-700 align-top"><CellWithTooltip text={r.stepTitle} /></td>
                      <td className="px-3 py-2 text-left text-gray-600 align-top"><CellWithTooltip text={r.subStepTitle || "-"} /></td>
                      <td className="px-3 py-2 text-left align-middle">
                        {count > 0 ? (
                          <button onClick={() => setOpenForStep(r.stepId || "")} className="text-left text-xs font-medium text-brand-blue hover:underline">
                            {blockerLabel}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-left text-gray-600 align-top"><CellWithTooltip text={r.assignedAt ? formatDateTime(r.assignedAt) : "-"} /></td>
                      <td className="px-3 py-2 text-left text-gray-600 align-top"><CellWithTooltip text={r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "-"} /></td>
                      <td className="px-3 py-2 text-left text-gray-600 align-top">
                        <CellWithTooltip text={r.finishedAt ? new Date(r.finishedAt).toLocaleString() : "-"} />
                      </td>
                      <td className="px-3 py-2 text-left align-top">
                        {r.isOnTime === null ? (
                          <span className="text-xs text-gray-500">N/A</span>
                        ) : r.isOnTime ? (
                          <span className="text-xs bg-green-100 text-green-700 border border-green-200 rounded px-2 py-0.5">On-Time</span>
                        ) : (
                          <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">Late {r.lateDays}d</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20 bg-brand-blue/[0.06] text-gray-600 shadow-sm">
              <tr>
                <th className="text-left px-3 py-2">Task</th>
                <th className="text-left px-3 py-2">Step</th>
                <th className="text-left px-3 py-2">Sub-step</th>
                <th className="text-left px-3 py-2">Resolved At</th>
                <th className="text-left px-3 py-2">Blocker</th>
                <th className="text-left px-3 py-2">Resolution Details</th>
                <th className="text-center px-3 py-2">Days Resolved</th>
                <th className="text-center px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingResolved ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">Loading resolved blockers...</td></tr>
              ) : resolvedRows.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">No resolved blockers found</td></tr>
              ) : (
                resolvedRows.map((row) => (
                  <tr key={row.id} className="border-t hover:bg-brand-blue/[0.04]">
                    <td className="px-3 py-2">{row.taskTitle}</td>
                    <td className="px-3 py-2">{row.stepTitle}</td>
                    <td className="px-3 py-2">{row.subStepTitle || "-"}</td>
                    <td className="px-3 py-2">{new Date(row.resolved_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{row.blocker_description}</td>
                    <td className="px-3 py-2">{row.resolution_details}</td>
                    <td className="px-3 py-2 text-center">{row.days_to_resolve}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setEditingRow(row); setEditResolutionText(row.resolution_details); }} className="rounded p-1 text-brand-blue hover:bg-brand-blue/10" title="Edit resolution details">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeletingRowId(row.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Delete resolution">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <BlockerDetailsModal open={!!openForStep} onOpenChange={(o) => !o && setOpenForStep(null)} items={openForStep ? getBlockersForStep(openForStep) : []} />

      {editingRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit Resolution Details</h3>
            <textarea value={editResolutionText} onChange={(e) => setEditResolutionText(e.target.value)} className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingRow(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md">Cancel</button>
              <button onClick={handleSaveEdit} disabled={!editResolutionText.trim() || isSaving} className="rounded-md bg-brand-blue px-4 py-2 text-sm text-white disabled:opacity-50">
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deletingRowId} onOpenChange={(open) => !open && setDeletingRowId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resolution</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this resolution? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteResolution} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportMainFooter />
    </div>
  );
};

