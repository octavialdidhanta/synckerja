import React, { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { useToast } from "@/shared/hooks/use-toast";
import { useHabitTracker } from "../context/HabitTrackerContext";

export const HabitEntryModal = ({ isOpen, onClose, habitId }: { isOpen: boolean; onClose: () => void; habitId: string }) => {
  const { habits, entries, addEntry } = useHabitTracker();
  const { toast } = useToast();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [count, setCount] = useState(1);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const habit = habits.find((h) => h.id === habitId);
  const existingEntry = entries.find((e) => e.habit_id === habitId && e.entry_date === date);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (existingEntry) {
      toast({ title: "Info", description: "Entry already exists for this date" });
      return;
    }
    setLoading(true);
    try {
      await addEntry(habitId, date, count, notes);
      toast({ title: "Success", description: "Entry logged successfully" });
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to log entry", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Entry</DialogTitle>
          <DialogDescription>{`Log your progress for ${habit?.name ?? "habit"}`}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div><Label>Count</Label><Input type="number" min="1" value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} required /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Log Entry"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
