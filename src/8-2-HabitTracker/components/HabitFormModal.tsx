import React, { useEffect, useMemo, useState } from "react";
import { useHabitTracker } from "../context/HabitTrackerContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Label } from "@/shared/components/ui/label";
import { useToast } from "@/shared/hooks/use-toast";
import { useIsMobile } from "@/mobile/hooks/use-mobile";
import { startOfMonth, getDaysInMonth, getDay, format } from "date-fns";
import { id } from "date-fns/locale";

interface HabitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  habitId?: string | null;
}

export const HabitFormModal = ({ isOpen, onClose, habitId }: HabitFormModalProps) => {
  const isMobile = useIsMobile();
  const { habits, addHabit, updateHabit } = useHabitTracker();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [targetCount, setTargetCount] = useState(1);
  const [checklistNames, setChecklistNames] = useState<string[]>([]);
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [monthlyDates, setMonthlyDates] = useState<number[]>([]);
  const [color, setColor] = useState("#3b82f6");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  const currentDate = new Date();
  const currentMonthStart = startOfMonth(currentDate);
  const daysInCurrentMonth = getDaysInMonth(currentDate);
  const firstDayOfWeek = getDay(currentMonthStart);
  const currentMonthName = format(currentDate, "MMMM yyyy", { locale: id });
  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i += 1) days.push(null);
    for (let i = 1; i <= daysInCurrentMonth; i += 1) days.push(i);
    return days;
  }, [firstDayOfWeek, daysInCurrentMonth]);

  const habit = habitId ? habits.find((h) => h.id === habitId) : null;

  useEffect(() => {
    let isMounted = true;
    if (!isOpen) {
      setIsInitializing(false);
      return () => {
        isMounted = false;
      };
    }
    if (habitId && !habit) {
      return () => {
        isMounted = false;
      };
    }
    setIsInitializing(true);
    if (habit) {
      setName(habit.name);
      setDescription(habit.description || "");
      setFrequency(habit.frequency);
      setTargetCount(habit.target_count);
      let loadedWeeklyDays: number[] = [];
      if (habit.frequency === "weekly" && habit.weekly_days) {
        if (Array.isArray(habit.weekly_days)) {
          loadedWeeklyDays = habit.weekly_days.filter(
            (day: unknown) =>
              typeof day === "number" && day >= 0 && day <= 6,
          );
        }
      }
      setWeeklyDays(loadedWeeklyDays);
      let loadedMonthlyDates: number[] = [];
      if (habit.frequency === "monthly" && habit.monthly_dates) {
        if (Array.isArray(habit.monthly_dates)) {
          loadedMonthlyDates = habit.monthly_dates.filter(
            (date: unknown) =>
              typeof date === "number" && date >= 1 && date <= 31,
          );
        }
      }
      setMonthlyDates(loadedMonthlyDates);
      let loadedChecklistNames: string[] = [];
      if (habit.frequency === "daily" && habit.checklist_names) {
        if (Array.isArray(habit.checklist_names)) {
          loadedChecklistNames = habit.checklist_names.map((item) =>
            item && typeof item === "string" ? item.trim() : "",
          );
        }
      }
      const finalChecklistNames =
        habit.frequency === "daily" && habit.target_count > 1
          ? Array.from({ length: habit.target_count }, (_, idx) => loadedChecklistNames[idx] || "")
          : [];
      requestAnimationFrame(() => {
        if (!isMounted) return;
        setChecklistNames(finalChecklistNames);
        setColor(habit.color || "#3b82f6");
        setIsActive(habit.is_active);
        setTimeout(() => {
          if (!isMounted) return;
          setIsInitializing(false);
        }, 100);
      });
    } else {
      setName("");
      setDescription("");
      setFrequency("daily");
      setTargetCount(1);
      setChecklistNames([]);
      setWeeklyDays([]);
      setMonthlyDates([]);
      setColor("#3b82f6");
      setIsActive(true);
      setIsInitializing(false);
    }
    return () => {
      isMounted = false;
    };
  }, [habit, isOpen, habitId]);

  useEffect(() => {
    if (!isOpen || isInitializing) return;
    if (frequency !== "daily") {
      if (checklistNames.length > 0) setChecklistNames([]);
      return;
    }
    if (habit && targetCount === habit.target_count) return;
    if (targetCount > 1) {
      const currentLength = checklistNames.length;
      if (currentLength < targetCount) {
        const newNames = [...checklistNames];
        for (let i = currentLength; i < targetCount; i += 1) newNames.push("");
        setChecklistNames(newNames);
      } else if (currentLength > targetCount) {
        setChecklistNames(checklistNames.slice(0, targetCount));
      }
    } else {
      setChecklistNames([]);
    }
  }, [targetCount, frequency, isOpen, isInitializing, checklistNames, habit]);

  useEffect(() => {
    if (!isOpen || isInitializing) return;
    if (frequency !== "daily" && checklistNames.length > 0) setChecklistNames([]);
  }, [frequency, isOpen, isInitializing, checklistNames.length]);

  useEffect(() => {
    if (!isOpen || isInitializing) return;
    if (frequency !== "weekly") return;
    if (weeklyDays.length > targetCount) {
      const trimmed = weeklyDays.slice(0, targetCount);
      setWeeklyDays(trimmed);
      toast({
        title: "Days Selection Updated",
        description: `Reduced to ${targetCount} day${targetCount > 1 ? "s" : ""} to match target count`,
      });
    }
  }, [targetCount, frequency, isOpen, isInitializing, weeklyDays, toast]);

  useEffect(() => {
    if (!isOpen || isInitializing) return;
    if (frequency !== "monthly") return;
    if (monthlyDates.length > targetCount) {
      const trimmed = monthlyDates.slice(0, targetCount).sort((a, b) => a - b);
      setMonthlyDates(trimmed);
      toast({
        title: "Dates Selection Updated",
        description: `Reduced to ${targetCount} date${targetCount > 1 ? "s" : ""} to match target count`,
      });
    }
  }, [targetCount, frequency, isOpen, isInitializing, monthlyDates, toast]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a habit name",
        variant: "destructive",
      });
      return;
    }
    if (frequency === "weekly") {
      if (weeklyDays.length === 0) {
        toast({
          title: "Error",
          description: "Please select at least one day for weekly habit",
          variant: "destructive",
        });
        return;
      }
      if (weeklyDays.length > targetCount) {
        toast({
          title: "Error",
          description: `You can only select up to ${targetCount} day${targetCount > 1 ? "s" : ""} for this habit. Please deselect ${weeklyDays.length - targetCount} day${weeklyDays.length - targetCount > 1 ? "s" : ""}`,
          variant: "destructive",
        });
        return;
      }
      if (targetCount > 1 && weeklyDays.length < targetCount) {
        toast({
          title: "Error",
          description: `Please select at least ${targetCount} days for this habit`,
          variant: "destructive",
        });
        return;
      }
    }
    if (frequency === "monthly") {
      if (monthlyDates.length === 0) {
        toast({
          title: "Error",
          description: "Please select at least one date for monthly habit",
          variant: "destructive",
        });
        return;
      }
      if (monthlyDates.length > targetCount) {
        toast({
          title: "Error",
          description: `You can only select up to ${targetCount} date${targetCount > 1 ? "s" : ""} for this habit. Please deselect ${monthlyDates.length - targetCount} date${monthlyDates.length - targetCount > 1 ? "s" : ""}`,
          variant: "destructive",
        });
        return;
      }
      if (targetCount > 1 && monthlyDates.length < targetCount) {
        toast({
          title: "Error",
          description: `Please select at least ${targetCount} dates for this habit`,
          variant: "destructive",
        });
        return;
      }
    }
    setLoading(true);
    try {
      if (habitId && habit) {
        const finalChecklistNames =
          targetCount > 1 && frequency === "daily"
            ? Array.from({ length: targetCount }, (_, idx) => checklistNames[idx] || "")
            : undefined;
        const finalWeeklyDays =
          frequency === "weekly" && weeklyDays.length > 0 ? weeklyDays : undefined;
        const finalMonthlyDates =
          frequency === "monthly" && monthlyDates.length > 0 ? monthlyDates : undefined;
        await updateHabit(habitId, {
          name,
          description,
          frequency,
          target_count: targetCount,
          checklist_names: finalChecklistNames,
          weekly_days: finalWeeklyDays,
          monthly_dates: finalMonthlyDates,
          color,
          is_active: isActive,
        });
        toast({ title: "Success", description: "Habit updated successfully" });
      } else {
        const finalChecklistNames =
          targetCount > 1 && frequency === "daily"
            ? Array.from({ length: targetCount }, (_, idx) => checklistNames[idx] || "")
            : undefined;
        const finalWeeklyDays =
          frequency === "weekly" && weeklyDays.length > 0 ? weeklyDays : undefined;
        const finalMonthlyDates =
          frequency === "monthly" && monthlyDates.length > 0 ? monthlyDates : undefined;
        await addHabit({
          name,
          description,
          frequency,
          target_count: targetCount,
          checklist_names: finalChecklistNames,
          weekly_days: finalWeeklyDays,
          monthly_dates: finalMonthlyDates,
          color,
          is_active: isActive,
        });
        toast({ title: "Success", description: "Habit created successfully" });
      }
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to save habit", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const colors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#84cc16",
    "#f97316",
    "#6366f1",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={
          isMobile
            ? "fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden"
            : "w-[600px] h-[600px] max-w-[600px] max-h-[600px] flex flex-col p-0 overflow-hidden"
        }
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={
            isMobile
              ? "flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 text-left safe-area-top px-4 pt-4 pb-3"
              : "flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200"
          }
        >
          <DialogTitle className={isMobile ? "text-lg font-semibold" : undefined}>
            {habitId ? "Edit Habit" : "Create New Habit"}
          </DialogTitle>
          <DialogDescription>
            {habitId ? "Update your habit details" : "Track your habits and build better routines"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className={`flex-1 overflow-y-auto seamless-scroll space-y-4 min-h-0 ${isMobile ? "px-4 py-4" : "px-6 py-4"}`}>
            <div>
              <Label htmlFor="name">Habit Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Exercise, Read, Meditate"
                required
                className={isMobile ? "text-sm" : undefined}
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
                className={isMobile ? "text-sm" : undefined}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={frequency} onValueChange={(value: any) => setFrequency(value)}>
                  <SelectTrigger className={isMobile ? "text-sm" : undefined}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="targetCount">Target Count</Label>
                <Input
                  id="targetCount"
                  type="number"
                  min="1"
                  value={targetCount}
                  onChange={(e) => setTargetCount(parseInt(e.target.value, 10) || 1)}
                  className={isMobile ? "text-sm" : undefined}
                />
              </div>
            </div>
            {frequency === "daily" && targetCount > 1 && (
              <div className="space-y-2">
                <Label>Checklist Names</Label>
                <p className="text-xs text-gray-500 mb-2">
                  Enter names for each checklist item (e.g., Solat Subuh, Solat Zuhur, etc.)
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto seamless-scroll border border-gray-200 rounded-md p-3">
                  {Array.from({ length: targetCount }, (_, index) => {
                    const currentValue = checklistNames[index] || "";
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <Label htmlFor={`checklist-${index}`} className="text-sm font-medium min-w-[80px]">
                          Checklist {index + 1}:
                        </Label>
                        <Input
                          id={`checklist-${index}`}
                          value={currentValue}
                          onChange={(e) => {
                            const newNames = [...checklistNames];
                            while (newNames.length < targetCount) newNames.push("");
                            newNames[index] = e.target.value;
                            setChecklistNames(newNames);
                          }}
                          placeholder={`e.g., ${index === 0 ? "Solat Subuh" : index === 1 ? "Solat Zuhur" : index === 2 ? "Solat Ashar" : index === 3 ? "Solat Maghrib" : "Solat Isya"}`}
                          className={isMobile ? "flex-1 text-sm" : "flex-1"}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {frequency === "weekly" && (
              <div className="space-y-2">
                <Label>Pilih Hari</Label>
                <p className="text-xs text-gray-500 mb-2">
                  Pilih hari-hari dalam seminggu untuk habit ini {targetCount > 1 ? `(minimal ${targetCount} hari, maksimal ${targetCount} hari)` : "(minimal 1 hari, maksimal 1 hari)"}
                </p>
                {weeklyDays.length > 0 && (
                  <p className={`text-xs mb-2 ${weeklyDays.length > targetCount ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                    Terpilih: {weeklyDays.length} dari {targetCount} hari
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {dayNames.map((dayName, index) => {
                    const isSelected = weeklyDays.includes(index);
                    const isMaxReached = !isSelected && weeklyDays.length >= targetCount;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setWeeklyDays(weeklyDays.filter((d) => d !== index));
                          } else {
                            if (weeklyDays.length >= targetCount) {
                              toast({
                                title: "Limit Reached",
                                description: `You can only select up to ${targetCount} day${targetCount > 1 ? "s" : ""} for this habit`,
                                variant: "destructive",
                              });
                              return;
                            }
                            setWeeklyDays([...weeklyDays, index].sort((a, b) => a - b));
                          }
                        }}
                        disabled={isMaxReached}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : isMaxReached
                              ? "bg-gray-50 text-gray-400 cursor-not-allowed opacity-50"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        title={isMaxReached ? `Maximum ${targetCount} day${targetCount > 1 ? "s" : ""} allowed` : undefined}
                      >
                        {dayName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {frequency === "monthly" && (
              <div className="space-y-2">
                <div>
                  <Label>Pilih Tanggal</Label>
                  <p className="text-xs text-gray-500 mb-1">
                    Pilih tanggal-tanggal dalam sebulan untuk habit ini {targetCount > 1 ? `(minimal ${targetCount} tanggal, maksimal ${targetCount} tanggal)` : "(minimal 1 tanggal, maksimal 1 tanggal)"}
                  </p>
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    {currentMonthName}
                  </p>
                </div>
                <div className="border border-gray-200 rounded-md p-3">
                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {dayNames.map((dayName) => (
                      <div key={dayName} className="text-xs font-semibold text-gray-600 text-center py-1">
                        {dayName.substring(0, 3)}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-2 max-h-64 overflow-y-auto seamless-scroll">
                    {calendarDays.map((date, index) => {
                      if (date === null) {
                        return <div key={`empty-${index}`} className="px-3 py-2 rounded-md text-sm" />;
                      }
                      const isSelected = monthlyDates.includes(date);
                      const isMaxReached = !isSelected && monthlyDates.length >= targetCount;
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setMonthlyDates(monthlyDates.filter((d) => d !== date));
                            } else {
                              if (monthlyDates.length >= targetCount) {
                                toast({
                                  title: "Limit Reached",
                                  description: `You can only select up to ${targetCount} date${targetCount > 1 ? "s" : ""} for this habit`,
                                  variant: "destructive",
                                });
                                return;
                              }
                              setMonthlyDates([...monthlyDates, date].sort((a, b) => a - b));
                            }
                          }}
                          disabled={isMaxReached}
                          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            isSelected
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : isMaxReached
                                ? "bg-gray-50 text-gray-400 cursor-not-allowed opacity-50"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {date}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {monthlyDates.length > 0 && (
                  <p className={`text-xs mb-2 ${monthlyDates.length > targetCount ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                    Terpilih: {monthlyDates.length} dari {targetCount} tanggal ({[...monthlyDates].sort((a, b) => a - b).join(", ")})
                  </p>
                )}
              </div>
            )}
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 ${color === c ? "border-gray-900" : "border-gray-300"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>
          {isMobile ? (
            <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading} className="min-w-[120px] flex items-center justify-center gap-1.5">
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{habitId ? "Updating..." : "Creating..."}</span>
                    </>
                  ) : habitId ? (
                    "Update"
                  ) : (
                    "Create"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <DialogFooter className="flex-shrink-0 px-6 pt-4 pb-6 border-t border-gray-200 mt-auto">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : habitId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};
