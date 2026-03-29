import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/components/ui/dialog";
import { supabase } from "@/shared/lib/supabaseClient";
import { useToast } from "@/shared/components/ui/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocker: {
    id: string;
    blocker_type?: string;
    description?: string;
    created_at: string;
    taskTitle?: string;
    stepTitle?: string;
    subStepTitle?: string | null;
  } | null;
  onResolutionComplete?: () => void;
}

export const BlockerResolutionModal: React.FC<Props> = ({ open, onOpenChange, blocker, onResolutionComplete }) => {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!blocker) return;
    if (!note.trim()) {
      toast({
        title: "Error",
        description: "Please provide resolution details",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error: insertError } = await supabase.rpc("save_blocker_resolution", {
        p_task_step_history_id: blocker.id,
        p_description: note.trim(),
      });

      if (insertError) {
        toast({
          title: "Error",
          description: `Failed to save resolution: ${insertError.message}`,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      if (onResolutionComplete) {
        try {
          await onResolutionComplete();
        } catch {
          toast({
            title: "Error",
            description: "Failed to update blocker status. Resolution was saved.",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
      }

      onOpenChange(false);
      setNote("");

      toast({
        title: "Success",
        description: "Blocker resolution saved successfully",
      });
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      setSaving(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="m-0 flex h-screen max-h-none w-screen max-w-none flex-col rounded-none border-border p-0 md:max-h-[520px] md:max-w-lg md:rounded-lg">
        <DialogHeader className="flex-shrink-0 border-b border-border px-4 pb-2 pt-4">
          <DialogTitle className="text-base md:text-lg">How was this blocker resolved?</DialogTitle>
        </DialogHeader>
        <div className="seamless-scroll min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4">
          {blocker && (
            <div className="rounded border border-border bg-muted/50 p-2">
              <div className="text-xs text-muted-foreground">
                Task: <span className="font-medium text-foreground">{blocker.taskTitle || "-"}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Step: <span className="font-medium text-foreground">{blocker.stepTitle || "-"}</span>
              </div>
              {blocker.subStepTitle && (
                <div className="text-xs text-muted-foreground">
                  Sub-step: <span className="font-medium text-foreground">{blocker.subStepTitle}</span>
                </div>
              )}
              <div className="mt-1 text-sm text-foreground">{blocker.blocker_type || "Blocker"}</div>
              {blocker.description && <div className="text-sm text-muted-foreground">{blocker.description}</div>}
              <div className="mt-1 text-xs text-muted-foreground">{new Date(blocker.created_at).toLocaleString()}</div>
            </div>
          )}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Resolution details</label>
            <textarea
              className="w-full min-h-[120px] rounded border border-input bg-background p-2 text-sm text-foreground"
              placeholder="Explain how this blocker was resolved..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="flex flex-shrink-0 flex-col-reverse gap-2 border-t border-border px-4 py-3 md:flex-row md:justify-end">
          <button
            type="button"
            className="w-full rounded border border-border px-4 py-2 text-sm md:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`w-full rounded px-4 py-2 text-sm text-primary-foreground md:w-auto ${saving ? "bg-primary/50" : "bg-primary hover:bg-primary/90"}`}
            onClick={handleSave}
            disabled={saving || !note.trim()}
          >
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
