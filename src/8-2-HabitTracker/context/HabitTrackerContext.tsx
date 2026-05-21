import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { useCurrentEmployee } from "@/shared/hooks/useCurrentEmployee";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/shared/lib/supabaseClient";
import { logger } from "@/shared/lib/logger";
import type { Habit, HabitEntry, HabitFilter, HabitStats } from "../types";

interface HabitTrackerContextType {
  habits: Habit[];
  entries: HabitEntry[];
  stats: HabitStats[];
  initialLoading: boolean;
  loading: boolean;
  filters: HabitFilter;
  updateFilter: <K extends keyof HabitFilter>(key: K, value: HabitFilter[K]) => void;
  addHabit: (
    habit: Omit<Habit, "id" | "created_at" | "updated_at" | "organization_id" | "employee_id" | "created_by">,
  ) => Promise<void>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  addEntry: (habitId: string, date: string, count: number, notes?: string) => Promise<void>;
  updateEntry: (id: string, updates: Partial<HabitEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  filteredHabits: Habit[];
}

const HabitTrackerContext = createContext<HabitTrackerContextType | undefined>(undefined);

export const useHabitTracker = () => {
  const ctx = useContext(HabitTrackerContext);
  if (!ctx) throw new Error("useHabitTracker must be used within HabitTrackerProvider");
  return ctx;
};

export const HabitTrackerProvider = ({ children }: { children: React.ReactNode }) => {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { user } = useCurrentUser();
  const { data: employee, isLoading: employeeLoading } = useCurrentEmployee();
  const { toast } = useToast();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [stats, setStats] = useState<HabitStats[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [effectSettled, setEffectSettled] = useState(false);
  const [lastLoadedOrgId, setLastLoadedOrgId] = useState<string | null>(null);
  const [filters, setFilters] = useState<HabitFilter>({
    search: "",
    frequency: "all",
    status: "all",
    dateRange: { start: null, end: null },
  });
  const isActiveRef = useRef(true);
  const employeeLoadingEverTrueRef = useRef(false);
  const profileIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      profileIdRef.current = null;
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) profileIdRef.current = data?.id ?? null;
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const fetchHabits = useCallback(async () => {
    if (!organizationId || !employee?.id) return;
    try {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const parsedHabits = (data || []).map((habit) => {
        const checklistNames = Array.isArray(habit.checklist_names) ? habit.checklist_names : undefined;
        const weeklyDays = Array.isArray(habit.weekly_days)
          ? habit.weekly_days.filter((day: unknown) => typeof day === "number" && day >= 0 && day <= 6)
          : undefined;
        const monthlyDates = Array.isArray(habit.monthly_dates)
          ? habit.monthly_dates.filter((date: unknown) => typeof date === "number" && date >= 1 && date <= 31)
          : undefined;
        return { ...habit, checklist_names: checklistNames, weekly_days: weeklyDays, monthly_dates: monthlyDates };
      });
      if (!isActiveRef.current) return;
      setHabits(parsedHabits);
    } catch (error) {
      logger.error("Error fetching habits", error);
      toast({ title: "Error", description: "Gagal memuat habits. Silakan refresh.", variant: "destructive" });
      if (!isActiveRef.current) return;
      setHabits([]);
    }
  }, [organizationId, employee?.id, toast]);

  const fetchEntries = useCallback(async () => {
    if (!organizationId || !employee?.id) return;
    try {
      const { data, error } = await supabase
        .from("habit_entries")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("employee_id", employee.id)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      if (!isActiveRef.current) return;
      setEntries(data || []);
    } catch (error) {
      logger.error("Error fetching entries", error);
      toast({ title: "Error", description: "Gagal memuat data entri. Silakan refresh.", variant: "destructive" });
      if (!isActiveRef.current) return;
      setEntries([]);
    }
  }, [organizationId, employee?.id, toast]);

  const calculateStats = useCallback(() => {
    const habitStats: HabitStats[] = habits.map((habit) => {
      const habitEntries = entries
        .filter((e) => e.habit_id === habit.id)
        .slice()
        .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
      const totalEntries = habitEntries.length;
      const targetDays = habit.frequency === "daily" ? 30 : habit.frequency === "weekly" ? 4 : 1;
      const expectedEntries = targetDays * (habit.target_count ?? 0);
      const completion_rate = expectedEntries > 0 ? (totalEntries / expectedEntries) * 100 : 0;
      return {
        habit_id: habit.id,
        habit_name: habit.name,
        total_entries: totalEntries,
        completion_rate: Math.min(completion_rate, 100),
        current_streak: 0,
        longest_streak: 0,
        last_entry_date: habitEntries[0]?.entry_date || null,
      };
    });
    if (!isActiveRef.current) return;
    setStats(habitStats);
  }, [habits, entries]);

  const refreshData = useCallback(async () => {
    setDataLoading(true);
    try {
      await Promise.all([fetchHabits(), fetchEntries()]);
      if (organizationId) {
        setLastLoadedOrgId(organizationId);
      }
    } finally {
      if (isActiveRef.current) {
        setDataLoading(false);
        setEffectSettled(true);
      }
    }
  }, [fetchHabits, fetchEntries, organizationId]);

  useEffect(() => {
    if (employeeLoading) employeeLoadingEverTrueRef.current = true;
    isActiveRef.current = true;
    if (organizationId && employee?.id) {
      refreshData();
    } else if (!organizationId || (!employeeLoading && employeeLoadingEverTrueRef.current)) {
      setDataLoading(false);
      setEffectSettled(true);
    }
    return () => {
      isActiveRef.current = false;
    };
  }, [organizationId, employee?.id, employeeLoading, refreshData]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const updateFilter = useCallback(<K extends keyof HabitFilter>(key: K, value: HabitFilter[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const addHabit: HabitTrackerContextType["addHabit"] = useCallback(
    async (habitData) => {
      if (!organizationId || !employee?.id || !user?.id) return;
      const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
      const { error } = await supabase.from("habits").insert({
        ...habitData,
        checklist_names: habitData.checklist_names?.length ? habitData.checklist_names : null,
        weekly_days: habitData.weekly_days?.length ? habitData.weekly_days : null,
        monthly_dates: habitData.monthly_dates?.length ? habitData.monthly_dates : null,
        organization_id: organizationId,
        employee_id: employee.id,
        created_by: profile?.id || null,
      });
      if (error) throw error;
      await refreshData();
    },
    [organizationId, employee?.id, user?.id, refreshData],
  );

  const updateHabit = useCallback(
    async (id: string, updates: Partial<Habit>) => {
      const { error } = await supabase.from("habits").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await refreshData();
    },
    [refreshData],
  );

  const deleteHabit = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
      await refreshData();
    },
    [refreshData],
  );

  const addEntry = useCallback(
    async (habitId: string, date: string, count: number, notes?: string) => {
      if (!organizationId || !employee?.id || !user?.id) return;

      const tempId = `optimistic-${habitId}-${date}-${Date.now()}`;
      const now = new Date().toISOString();
      const optimisticEntry: HabitEntry = {
        id: tempId,
        habit_id: habitId,
        entry_date: date,
        count,
        notes,
        created_at: now,
        updated_at: now,
        organization_id: organizationId,
        employee_id: employee.id,
        created_by: profileIdRef.current ?? undefined,
      };

      setEntries((prev) => {
        if (prev.some((e) => e.habit_id === habitId && e.entry_date === date)) return prev;
        return [...prev, optimisticEntry];
      });

      try {
        let createdBy = profileIdRef.current;
        if (!createdBy) {
          const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
          createdBy = profile?.id ?? null;
          profileIdRef.current = createdBy;
        }

        const { data: newEntry, error } = await supabase
          .from("habit_entries")
          .insert({
            habit_id: habitId,
            entry_date: date,
            count,
            notes,
            organization_id: organizationId,
            employee_id: employee.id,
            created_by: createdBy,
          })
          .select()
          .single();

        if (error) throw error;

        if (newEntry) {
          setEntries((prev) => [...prev.filter((e) => e.id !== tempId), newEntry]);
        } else {
          setEntries((prev) => prev.filter((e) => e.id !== tempId));
        }
      } catch (error) {
        setEntries((prev) => prev.filter((e) => e.id !== tempId));
        throw error;
      }
    },
    [organizationId, employee?.id, user?.id],
  );

  const updateEntry = useCallback(
    async (id: string, updates: Partial<HabitEntry>) => {
      const { error } = await supabase.from("habit_entries").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await refreshData();
    },
    [refreshData],
  );

  const deleteEntry = useCallback(async (id: string) => {
    let removed: HabitEntry | undefined;
    setEntries((prev) => {
      removed = prev.find((entry) => entry.id === id);
      return prev.filter((entry) => entry.id !== id);
    });

    try {
      const { error } = await supabase.from("habit_entries").delete().eq("id", id);
      if (error) throw error;
      if (id.startsWith("optimistic-")) return;
    } catch (error) {
      if (removed) {
        setEntries((prev) => (prev.some((e) => e.id === removed!.id) ? prev : [...prev, removed!]));
      }
      throw error;
    }
  }, []);

  const filteredHabits = React.useMemo(() => {
    return habits.filter((habit) => {
      if (filters.search && !(habit.name ?? "").toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.frequency !== "all" && habit.frequency !== filters.frequency) return false;
      if (filters.status !== "all") {
        if (filters.status === "active" && !habit.is_active) return false;
        if (filters.status === "inactive" && habit.is_active) return false;
      }
      return true;
    });
  }, [habits, filters]);

  const loading = !effectSettled || orgLoading || employeeLoading || dataLoading;
  const initialLoading =
    orgLoading ||
    employeeLoading ||
    !effectSettled ||
    (Boolean(organizationId) && lastLoadedOrgId !== organizationId);

  return (
    <HabitTrackerContext.Provider
      value={{
        habits,
        entries,
        stats,
        initialLoading,
        loading,
        filters,
        updateFilter,
        addHabit,
        updateHabit,
        deleteHabit,
        addEntry,
        updateEntry,
        deleteEntry,
        refreshData,
        filteredHabits,
      }}
    >
      {children}
    </HabitTrackerContext.Provider>
  );
};

