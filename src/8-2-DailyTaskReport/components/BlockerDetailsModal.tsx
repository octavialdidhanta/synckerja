import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { supabase } from "@/shared/lib/supabaseClient";
import { BlockerResolutionModal } from "./BlockerResolutionModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useToast } from "@/shared/components/ui/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Array<{
    id: string;
    blocker_type?: string;
    description?: string;
    created_at: string;
    subStepTitle?: string | null;
    is_resolved?: boolean;
    created_by_employee?: { full_name: string } | null;
    taskTitle?: string;
    stepTitle?: string;
  }>;
  initialTab?: "list" | "resolved";
  loading?: boolean;
}

export const BlockerDetailsModal: React.FC<Props> = ({
  open,
  onOpenChange,
  items,
  initialTab = "list",
  loading = false,
}) => {
  const [localItems, setLocalItems] = useState<Props["items"]>(items || []);
  const [resolutionFor, setResolutionFor] = useState<Props["items"][number] | null>(null);
  const [resolvedRows, setResolvedRows] = useState<
    Array<{
      id: string;
      task_step_history_id: string;
      description: string;
      created_at: string;
      blocker_description?: string;
      taskTitle?: string;
      stepTitle?: string;
      subStepTitle?: string | null;
    }>
  >([]);
  const [tab, setTab] = useState<"list" | "resolved">(initialTab);
  const [isLoadingResolved, setIsLoadingResolved] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setLocalItems(items || []);
      setTab(initialTab);
    }
  }, [open, items, initialTab]);

  const markResolved = async (id: string) => {
    const found = localItems.find((it) => it.id === id) || null;
    setResolutionFor(found || null);
  };

  const handleResolutionComplete = async () => {
    if (!resolutionFor) return;

    try {
      const { error } = await supabase
        .from("task_step_history")
        .update({ is_resolved: true })
        .eq("id", resolutionFor.id);

      if (error) {
        toast({
          title: "Error",
          description: `Failed to mark blocker as resolved: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      const { data: resolutionCheck, error: checkError } = await supabase.rpc("get_blocker_resolutions", {
        p_task_step_history_ids: [resolutionFor.id],
      });

      if (!checkError && (!resolutionCheck || resolutionCheck.length === 0)) {
        toast({
          title: "Warning",
          description: "Blocker marked as resolved but resolution details may not have been saved",
          variant: "destructive",
        });
      }

      setLocalItems((prev) => prev.filter((it) => it.id !== resolutionFor.id));
      setResolutionFor(null);
      setTab("resolved");

      toast({
        title: "Success",
        description: "Blocker marked as resolved",
      });
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred while updating blocker status",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const loadResolved = async () => {
      const ids = (localItems || []).map((b) => b.id).filter(Boolean);
      if (!open || ids.length === 0) {
        setResolvedRows([]);
        setIsLoadingResolved(false);
        return;
      }

      setIsLoadingResolved(true);
      try {
        const { data, error } = await supabase.rpc("get_blocker_resolutions", {
          p_task_step_history_ids: ids,
        });

        if (error) {
          setResolvedRows([]);
          return;
        }

        const mapped = (data || []).map((row: Record<string, unknown>) => {
          const source = (localItems || []).find((b) => b.id === row.task_step_history_id);
          return {
            id: row.id as string,
            task_step_history_id: row.task_step_history_id as string,
            description: row.description as string,
            created_at: row.created_at as string,
            blocker_description: source?.description || null,
            taskTitle: source?.taskTitle || "-",
            stepTitle: source?.stepTitle || "-",
            subStepTitle: source?.subStepTitle || null,
          };
        });
        setResolvedRows(mapped);
      } catch {
        setResolvedRows([]);
      } finally {
        setIsLoadingResolved(false);
      }
    };
    loadResolved();
  }, [open, localItems]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="m-0 flex h-screen max-h-none w-screen max-w-none flex-col rounded-none border-border p-0 md:max-h-[520px] md:max-w-2xl md:rounded-lg">
          <DialogHeader className="flex-shrink-0 border-b border-border px-4 pb-2 pt-4">
            <DialogTitle className="text-base md:text-lg">Blockers</DialogTitle>
          </DialogHeader>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "list" | "resolved")} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-4 mb-2 mt-2">
              <TabsTrigger value="list" className="text-xs md:text-sm">
                Blockers
              </TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs md:text-sm">
                Blocker Resolved
              </TabsTrigger>
            </TabsList>
            <TabsContent value="list" className="min-h-0 flex-1 px-4 pb-4">
              <div className="seamless-scroll min-h-0 flex-1 space-y-2 overflow-auto">
                {localItems.length === 0 && loading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <span className="animate-pulse">Loading blockers...</span>
                  </div>
                ) : localItems.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                ) : localItems.filter((b) => !b.is_resolved).length === 0 ? (
                  <div className="text-xs text-muted-foreground md:text-sm">No unresolved blockers.</div>
                ) : (
                  localItems
                    .filter((b) => !b.is_resolved)
                    .map((b) => (
                      <div key={b.id} className="rounded border border-destructive/30 bg-destructive/5 p-2">
                        <div className="text-xs text-muted-foreground">
                          Task: <span className="font-medium text-foreground">{b.taskTitle || "-"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Step: <span className="font-medium text-foreground">{b.stepTitle || "-"}</span>
                        </div>
                        {b.subStepTitle && (
                          <div className="text-xs text-muted-foreground">
                            Sub-step: <span className="font-medium text-foreground">{b.subStepTitle}</span>
                          </div>
                        )}
                        <div className="mt-1 text-xs font-medium text-destructive md:text-sm">{b.blocker_type || "Blocker"}</div>
                        {b.description && <div className="text-xs text-destructive md:text-sm">{b.description}</div>}
                        {b.created_by_employee?.full_name && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            created by : <span className="font-medium">{b.created_by_employee.full_name}</span>
                          </div>
                        )}
                        <div className="mt-2 flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
                          <div className="text-xs text-destructive">{new Date(b.created_at).toLocaleString()}</div>
                          <div className="flex items-center gap-2">
                            {b.is_resolved && (
                              <span className="rounded border border-green-200 bg-green-100 px-2 py-0.5 text-[10px] text-green-700">
                                Resolved
                              </span>
                            )}
                            <button
                              type="button"
                              className={`rounded border px-2 py-1 text-xs ${b.is_resolved ? "cursor-not-allowed border-border bg-muted text-muted-foreground" : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"}`}
                              disabled={!!b.is_resolved}
                              onClick={() => markResolved(b.id)}
                            >
                              Resolve
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </TabsContent>
            <TabsContent value="resolved" className="min-h-0 flex-1 px-4 pb-4">
              <div className="seamless-scroll min-h-0 flex-1 overflow-auto overflow-x-auto">
                {isLoadingResolved ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                ) : resolvedRows.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground md:text-sm">No resolved records</div>
                ) : (
                  <div className="space-y-2 md:hidden">
                    {resolvedRows.map((row) => (
                      <div key={row.id} className="space-y-2 rounded-lg border border-border bg-card p-3">
                        <div className="text-xs font-semibold text-foreground">{row.taskTitle || "-"}</div>
                        <div className="text-xs text-muted-foreground">{row.stepTitle || "-"}</div>
                        <div className="text-xs text-muted-foreground">{row.subStepTitle || "-"}</div>
                        <div className="text-xs text-muted-foreground">Resolved: {new Date(row.created_at).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">
                          <div className="mb-1 font-medium">Blocker:</div>
                          <div>{row.blocker_description || "-"}</div>
                        </div>
                        <div className="text-xs text-foreground">
                          <div className="mb-1 font-medium">Resolution:</div>
                          <div>{row.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {resolvedRows.length > 0 && (
                  <table className="hidden min-w-max text-sm md:table">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2 text-left">Task</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left">Step</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left">Sub-step</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left">Resolved At</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left">Blocker</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left">Resolution Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolvedRows.map((row) => (
                        <tr key={row.id} className="border-t border-border">
                          <td className="whitespace-nowrap px-3 py-2 text-foreground">{row.taskTitle || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-foreground">{row.stepTitle || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-foreground">{row.subStepTitle || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{new Date(row.created_at).toLocaleString()}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-foreground">{row.blocker_description || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-foreground">{row.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <BlockerResolutionModal
        open={!!resolutionFor}
        onOpenChange={(o) => {
          if (!o) {
            setResolutionFor(null);
          }
        }}
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
    </>
  );
};
