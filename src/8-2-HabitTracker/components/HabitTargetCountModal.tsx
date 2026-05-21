import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { useToast } from "@/shared/hooks/use-toast";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/mobile/shared/hooks/use-mobile";
import { useHabitTracker } from "../context/HabitTrackerContext";
import {
  buildChecklistCheckedState,
  formatHabitChecklistIndexNote,
} from "../utils/habitEntryChecklistIndex";

interface HabitTargetCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  habitId: string;
  date: Date;
}

export const HabitTargetCountModal = ({ isOpen, onClose, habitId, date }: HabitTargetCountModalProps) => {
  const isMobile = useIsMobile();
  const { habits, entries, addEntry, deleteEntry, refreshData } = useHabitTracker();
  const { toast } = useToast();
  const habit = habits.find((h) => h.id === habitId);
  const dateStr = format(date, "yyyy-MM-dd");
  const targetCount = habit?.target_count || 1;
  const existingEntries = useMemo(
    () => entries.filter((e) => e.habit_id === habitId && e.entry_date === dateStr),
    [entries, habitId, dateStr],
  );
  const [checkedItems, setCheckedItems] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(false);
  const checkedCount = checkedItems.filter(Boolean).length;

  useEffect(() => {
    if (!isOpen) return;
    setCheckedItems(buildChecklistCheckedState(existingEntries, targetCount));
  }, [isOpen, targetCount, existingEntries]);

  const handleSave = async () => {
    setLoading(true);
    try {
      for (const entry of existingEntries) await deleteEntry(entry.id);
      for (let i = 0; i < checkedItems.length; i += 1) {
        if (checkedItems[i]) {
          await addEntry(habitId, dateStr, 1, formatHabitChecklistIndexNote(i));
        }
      }
      await refreshData();
      toast({ title: "Success", description: `${checkedCount} of ${targetCount} completions logged` });
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to save entries", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!habit) return null;

  const checklistBody = (
    <>
      <div
        className={cn(
          "flex items-center justify-between rounded-md border bg-gray-50 text-sm",
          isMobile ? "px-4 py-3" : "px-3 py-2",
        )}
      >
        <span className="font-medium text-gray-700">Completed</span>
        <span className="font-semibold text-primary">
          {checkedCount}/{targetCount}
        </span>
      </div>
      <div className={cn("space-y-3", isMobile ? "py-1" : "py-2")}>
        {Array.from({ length: targetCount }).map((_, i) => (
          <div className="flex items-center gap-3" key={`${habitId}-${dateStr}-${i}`}>
            <Checkbox
              checked={checkedItems[i] ?? false}
              onCheckedChange={(c) =>
                setCheckedItems((p) => p.map((v, idx) => (idx === i ? Boolean(c) : v)))
              }
            />
            <Label className={isMobile ? "text-sm leading-snug" : undefined}>
              {habit.checklist_names?.[i]?.trim() || `${i + 1} of ${targetCount}`}
            </Label>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCheckedItems(new Array(targetCount).fill(true))}
          disabled={loading}
        >
          Select all
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCheckedItems(new Array(targetCount).fill(false))}
          disabled={loading}
        >
          Clear
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setCheckedItems((prev) =>
              prev.map((value, index) => {
                if (index === 0) return !value;
                return value;
              }),
            )
          }
          disabled={loading || targetCount <= 0}
        >
          Toggle first
        </Button>
      </div>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={
          isMobile
            ? "fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden"
            : "max-w-md flex flex-col gap-4"
        }
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={
            isMobile
              ? "flex-shrink-0 border-b bg-gradient-to-r from-primary/5 to-primary/10 text-left safe-area-top px-4 pt-4 pb-3"
              : undefined
          }
        >
          <DialogTitle className={isMobile ? "text-lg font-semibold" : undefined}>
            Log Habit Entries
          </DialogTitle>
          <DialogDescription className={isMobile ? "text-sm" : undefined}>
            {`Select completions for "${habit.name}" on ${format(date, "MMM d, yyyy")}`}
          </DialogDescription>
        </DialogHeader>

        {isMobile ? (
          <div className="scrollbar-hide seamless-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            {checklistBody}
          </div>
        ) : (
          checklistBody
        )}

        {isMobile ? (
          <div className="flex-shrink-0 space-y-2 border-t bg-muted/30 px-4 py-3">
            <Button className="w-full" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" className="w-full" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
