import React, { useMemo, useState } from "react";
import { Clock, Edit, Trash2 } from "lucide-react";
import { useDailyTaskReport } from "../context/ReportContext";
import { BlockerDetailsModal } from "./BlockerDetailsModal";
import { BlockerResolutionModal } from "./BlockerResolutionModal";
import { ReportSidebarFooter } from "./ReportSidebarFooter";
import { logger } from "@/shared/lib/logger";
import { supabase } from "@/shared/lib/supabaseClient";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useToast } from "@/shared/components/ui/use-toast";
import { formatDateTime } from "@/shared/utils/dateFormatter";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/shared/components/ui/alert-dialog";

export const BlockersAndUpdatesPanel = () => {
  const { filteredBlockers: blockers, filteredRecentUpdates: recentUpdates, loading, refreshReport } = useDailyTaskReport() as any;
  const [activeTab, setActiveTab] = useState<"blockers" | "updates">("blockers");
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<"list" | "resolved">("list");
  const [resolutionFor, setResolutionFor] = useState<any | null>(null);
  const [locResolved, setLocResolved] = useState<Record<string, boolean>>({});
  const [deletingBlocker, setDeletingBlocker] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [locDeleted, setLocDeleted] = useState<Record<string, boolean>>({});
  const [editingBlocker, setEditingBlocker] = useState<any | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleResolutionComplete = async () => {
    if (!resolutionFor) return;
    try {
      const { error } = await supabase.from("task_step_history").update({ is_resolved: true } as any).eq("id", resolutionFor.id);
      if (error) {
        logger.warn("Error updating blocker resolution status", error);
        toast({ title: "Error", description: `Failed to mark blocker as resolved: ${error.message}`, variant: "destructive" });
        return;
      }
      setLocResolved((prev) => ({ ...prev, [resolutionFor.id]: true }));
      setResolutionFor(null);
      toast({ title: "Success", description: "Blocker marked as resolved" });
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred while updating blocker status", variant: "destructive" });
    }
  };

  const unresolvedBlockers = useMemo(
    () => (blockers || []).filter((b: any) => (b.is_resolved === null || b.is_resolved === false) && !locResolved[b.id] && !locDeleted[b.id]),
    [blockers, locResolved, locDeleted],
  );

  const grouped = useMemo(() => {
    const map: Record<string, Record<string, any[]>> = {};
    unresolvedBlockers.forEach((b: any) => {
      const task = b.taskTitle || "-";
      const step = b.stepTitle || "-";
      map[task] = map[task] || {};
      map[task][step] = map[task][step] || [];
      map[task][step].push(b);
    });
    return map;
  }, [unresolvedBlockers]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-white ring-1 ring-brand-blue/10">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "blockers" | "updates")} className="flex flex-col flex-1 min-h-0">
        <div className="border-b border-brand-blue/15 bg-brand-blue/[0.06]">
          <TabsList className="w-full h-auto bg-transparent p-0 rounded-none border-none">
            <TabsTrigger value="blockers" className="flex-1 rounded-none border-b-2 border-transparent px-3 py-2 text-sm font-medium data-[state=active]:border-brand-blue data-[state=active]:bg-transparent data-[state=active]:text-brand-blue data-[state=active]:shadow-none">
              Blockers
              {unresolvedBlockers.length > 0 && <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-semibold">{unresolvedBlockers.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="updates" className="flex-1 rounded-none border-b-2 border-transparent px-3 py-2 text-sm font-medium data-[state=active]:border-brand-blue data-[state=active]:bg-transparent data-[state=active]:text-brand-blue data-[state=active]:shadow-none">
              Recent Updates
              {(recentUpdates || []).length > 0 && <span className="ml-2 rounded-full bg-brand-blue/15 px-1.5 py-0.5 text-xs font-semibold text-brand-blue">{recentUpdates.length}</span>}
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col m-0 min-h-0">
          <div className="p-3 space-y-2 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain flex-1 min-h-0">
            {activeTab === "blockers" ? (
              loading ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : unresolvedBlockers.length === 0 ? (
                <div className="text-sm text-gray-500">No blockers reported.</div>
              ) : (
                Object.entries(grouped).map(([taskTitle, steps]) => (
                  <div key={taskTitle} className="mb-2 rounded-md border border-brand-blue/20 bg-brand-blue/[0.04] p-2">
                    <div className="text-sm font-semibold text-gray-900 mb-1">Task: {taskTitle}</div>
                    {Object.entries(steps).map(([stepTitle, items]) => (
                      <div key={taskTitle + stepTitle} className="mb-2 ml-1 rounded-md border border-brand-blue/15 bg-white p-2">
                        <div className="text-sm font-medium text-gray-800 mb-1">Step: {stepTitle}</div>
                        {(items as any[]).filter((b: any) => !locDeleted[b.id]).map((b: any) => (
                          <div key={b.id} className="p-2 border border-red-200 bg-red-50 rounded text-sm mb-1">
                            {b.subStepTitle && <div className="text-red-700 font-semibold mb-0.5">Sub-step: {b.subStepTitle}</div>}
                            <div className="text-red-700 font-medium">{b.blocker_type || "Blocker"}</div>
                            {b.description && <div className="text-red-800">{b.description}</div>}
                            <div className="flex items-center justify-between mt-1">
                              <div className="text-xs text-red-600">{new Date(b.created_at).toLocaleString()}</div>
                              <div className="flex items-center gap-2">
                                <button className={`text-xs rounded px-2 py-1 border ${b.is_resolved || locResolved[b.id] ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "bg-green-600 text-white border-green-700 hover:bg-green-700"}`} disabled={!!(b.is_resolved || locResolved[b.id])} onClick={() => setResolutionFor(b)}>
                                  Resolve
                                </button>
                                <button className="rounded border border-brand-blue/80 bg-brand-blue p-1.5 text-white hover:bg-brand-blue/90" onClick={() => { setEditingBlocker(b); setEditDescription(b.description || ""); }} title="Edit blocker">
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button className="p-1.5 rounded border bg-red-600 text-white border-red-700 hover:bg-red-700" onClick={() => setDeletingBlocker(b)} title="Delete blocker">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))
              )
            ) : loading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : (recentUpdates || []).length === 0 ? (
              <div className="text-sm text-gray-500">No updates.</div>
            ) : (
              (recentUpdates || []).map((u: any) => (
                <div key={u.id} className="rounded border border-brand-blue/20 bg-brand-blue/[0.04] p-2 text-sm">
                  <div className="text-gray-900 font-medium">{(u.action_type || "").replace(/_/g, " ")}</div>
                  <div className="text-gray-700">{u.description || ""}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    <div>Task: <span className="font-medium text-gray-800">{u.taskTitle || "-"}</span></div>
                    <div>Step: <span className="font-medium text-gray-800">{u.stepTitle || "-"}</span></div>
                    {u.assignedAt && <div className="flex items-center gap-1 mt-1 text-gray-500"><Clock className="w-3 h-3" />Assigned at: {formatDateTime(u.assignedAt)}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Tabs>

      <BlockerDetailsModal open={open} onOpenChange={setOpen} items={blockers || []} initialTab={initialTab} />
      <BlockerResolutionModal
        open={!!resolutionFor}
        onOpenChange={(o) => !o && setResolutionFor(null)}
        blocker={
          resolutionFor
            ? {
                id: resolutionFor.id,
                blocker_type: resolutionFor.blocker_type,
                description: resolutionFor.description,
                created_at: resolutionFor.created_at,
                taskTitle: resolutionFor.taskTitle,
                stepTitle: resolutionFor.stepTitle,
                subStepTitle: resolutionFor.subStepTitle,
              }
            : null
        }
        onResolutionComplete={handleResolutionComplete}
      />

      {editingBlocker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit Blocker</h3>
            <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingBlocker(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md">Cancel</button>
              <button onClick={async () => {
                if (!editingBlocker || !editDescription.trim()) return;
                setIsSaving(true);
                await supabase.from("task_step_history").update({ description: editDescription.trim() }).eq("id", editingBlocker.id);
                setIsSaving(false);
                setEditingBlocker(null);
                if (refreshReport) await refreshReport();
              }} disabled={!editDescription.trim() || isSaving} className="rounded-md bg-brand-blue px-4 py-2 text-sm text-white disabled:opacity-50">
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deletingBlocker} onOpenChange={(open) => !open && setDeletingBlocker(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blocker</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this blocker? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!deletingBlocker) return;
              setIsDeleting(true);
              await supabase.from("task_step_history").delete().eq("id", deletingBlocker.id);
              setLocDeleted((p) => ({ ...p, [deletingBlocker.id]: true }));
              setDeletingBlocker(null);
              setIsDeleting(false);
            }} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? "Deleting..." : "Delete Blocker"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportSidebarFooter />
    </div>
  );
};

