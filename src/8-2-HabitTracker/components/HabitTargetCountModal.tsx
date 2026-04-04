import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { useToast } from "@/shared/hooks/use-toast";
import { useHabitTracker } from "../context/HabitTrackerContext";

interface HabitTargetCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  habitId: string;
  date: Date;
}

export const HabitTargetCountModal = ({ isOpen, onClose, habitId, date }: HabitTargetCountModalProps) => {
  const { habits, entries, addEntry, deleteEntry, refreshData } = useHabitTracker();
  const { toast } = useToast();
  const habit = habits.find((h) => h.id === habitId);
  const dateStr = format(date, "yyyy-MM-dd");
  const targetCount = habit?.target_count || 1;
  const existingEntries = useMemo(() => entries.filter((e) => e.habit_id === habitId && e.entry_date === dateStr), [entries, habitId, dateStr]);
  const [checkedItems, setCheckedItems] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(false);
  const checkedCount = checkedItems.filter(Boolean).length;

  useEffect(() => {
    if (!isOpen) return;
    const initial = new Array(targetCount).fill(false);
    for (let i = 0; i < Math.min(existingEntries.length, targetCount); i += 1) initial[i] = true;
    setCheckedItems(initial);
  }, [isOpen, targetCount, existingEntries.length]);

  const handleSave = async () => {
    setLoading(true);
    try {
      for (const entry of existingEntries) await deleteEntry(entry.id);
      for (let i = 0; i < checkedCount; i += 1) await addEntry(habitId, dateStr, 1);
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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Habit Entries</DialogTitle>
          <DialogDescription>{`Select completions for "${habit.name}" on ${format(date, "MMM d, yyyy")}`}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-md border bg-gray-50 px-3 py-2 text-sm">
          <span className="font-medium text-gray-700">Completed</span>
          <span className="font-semibold text-primary">{checkedCount}/{targetCount}</span>
        </div>
        <div className="space-y-3 py-2">
          {Array.from({ length: targetCount }).map((_, i) => (
            <div className="flex items-center gap-3" key={`${habitId}-${dateStr}-${i}`}>
              <Checkbox checked={checkedItems[i] ?? false} onCheckedChange={(c) => setCheckedItems((p) => p.map((v, idx) => (idx === i ? Boolean(c) : v)))} />
              <Label>{habit.checklist_names?.[i]?.trim() || `${i + 1} of ${targetCount}`}</Label>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setCheckedItems(new Array(targetCount).fill(true))} disabled={loading}>
            Select all
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setCheckedItems(new Array(targetCount).fill(false))} disabled={loading}>
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
