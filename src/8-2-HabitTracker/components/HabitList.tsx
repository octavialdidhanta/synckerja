import React, { useState } from "react";
import { CheckCircle2, Circle, Edit, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { useHabitTracker } from "../context/HabitTrackerContext";
import { HabitEntryModal } from "./HabitEntryModal";
import { HabitFormModal } from "./HabitFormModal";

export const HabitList = () => {
  const { filteredHabits, deleteHabit } = useHabitTracker();
  const [editingHabit, setEditingHabit] = useState<string | null>(null);
  const [entryHabit, setEntryHabit] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Habits</CardTitle>
          <Button size="sm" onClick={() => setShowAddModal(true)}><Plus className="mr-2 h-4 w-4" />Add Habit</Button>
        </div>
      </CardHeader>
      <CardContent className="seamless-scroll flex-1 overflow-y-auto">
        {filteredHabits.length === 0 ? (
          <div className="py-12 text-center text-gray-500"><Circle className="mx-auto mb-2 h-10 w-10 text-gray-300" />No habits found</div>
        ) : (
          <div className="space-y-3">
            {filteredHabits.map((habit) => (
              <Card key={habit.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: habit.color || "#3b82f6" }} />
                        <h3 className="truncate font-semibold">{habit.name}</h3>
                        {!habit.is_active ? <Badge variant="secondary">Inactive</Badge> : <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                      {habit.description ? <p className="mt-1 text-sm text-gray-600">{habit.description}</p> : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEntryHabit(habit.id)}>Log Entry</Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingHabit(habit.id)}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-red-600" onClick={() => deleteHabit(habit.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
      {showAddModal ? <HabitFormModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} /> : null}
      {editingHabit ? <HabitFormModal isOpen onClose={() => setEditingHabit(null)} habitId={editingHabit} /> : null}
      {entryHabit ? <HabitEntryModal isOpen onClose={() => setEntryHabit(null)} habitId={entryHabit} /> : null}
    </Card>
  );
};
