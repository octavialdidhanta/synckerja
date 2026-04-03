import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { toast } from "sonner";
import type { BusinessExpenseItem } from "../types/pricingTypes";

interface BusinessExpenseRow {
  id: string;
  organization_id: string;
  created_by: string;
  category: string;
  name: string;
  amount: number;
  month: number | null;
  time_period: "monthly" | "yearly";
  year: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const mapRowToItem = (row: BusinessExpenseRow): BusinessExpenseItem => ({
  id: row.id,
  category: row.category,
  name: row.name,
  amount: row.amount,
  month: row.month ?? undefined,
});

export const useBusinessExpenses = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["business-expenses", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("business_expenses")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((row) => mapRowToItem(row as BusinessExpenseRow));
    },
    enabled: !!organizationId,
  });

  const createExpense = useMutation({
    mutationFn: async (
      expense: Omit<BusinessExpenseItem, "id"> & { time_period: "monthly" | "yearly"; year?: number },
    ) => {
      if (!organizationId) throw new Error("Organization not found");

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("business_expenses")
        .insert({
          organization_id: organizationId,
          created_by: userData.user.id,
          category: expense.category,
          name: expense.name,
          amount: expense.amount,
          month: expense.month ?? null,
          time_period: expense.time_period,
          year: expense.year ?? null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return mapRowToItem(data as BusinessExpenseRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-expenses", organizationId] });
      toast.success("Business expense saved successfully");
    },
    onError: () => {
      toast.error("Failed to save business expense");
    },
  });

  const updateExpense = useMutation({
    mutationFn: async ({
      id,
      ...expense
    }: BusinessExpenseItem & { time_period: "monthly" | "yearly"; year?: number }) => {
      if (!organizationId) throw new Error("Organization not found");

      const { data, error } = await supabase
        .from("business_expenses")
        .update({
          category: expense.category,
          name: expense.name,
          amount: expense.amount,
          month: expense.month ?? null,
        })
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select()
        .single();

      if (error) throw error;
      return mapRowToItem(data as BusinessExpenseRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-expenses", organizationId] });
      toast.success("Business expense updated successfully");
    },
    onError: () => {
      toast.error("Failed to update business expense");
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error("Organization not found");

      const { error } = await supabase
        .from("business_expenses")
        .update({ is_active: false })
        .eq("id", id)
        .eq("organization_id", organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-expenses", organizationId] });
      toast.success("Business expense deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete business expense");
    },
  });

  const saveMultipleExpenses = useMutation({
    mutationFn: async (
      expenseRows: (Omit<BusinessExpenseItem, "id"> & { time_period: "monthly" | "yearly"; year?: number })[],
    ) => {
      if (!organizationId) throw new Error("Organization not found");

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("business_expenses")
        .insert(
          expenseRows.map((expense) => ({
            organization_id: organizationId,
            created_by: userData.user.id,
            category: expense.category,
            name: expense.name,
            amount: expense.amount,
            month: expense.month ?? null,
            time_period: expense.time_period,
            year: expense.year ?? null,
            is_active: true,
          })),
        )
        .select();

      if (error) throw error;
      return (data || []).map((row) => mapRowToItem(row as BusinessExpenseRow));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-expenses", organizationId] });
      toast.success("Business expenses saved successfully");
    },
    onError: () => {
      toast.error("Failed to save business expenses");
    },
  });

  return {
    expenses,
    isLoading,
    createExpense: createExpense.mutateAsync,
    updateExpense: updateExpense.mutateAsync,
    deleteExpense: deleteExpense.mutateAsync,
    saveMultipleExpenses: saveMultipleExpenses.mutateAsync,
    isCreating: createExpense.isPending,
    isUpdating: updateExpense.isPending,
    isDeleting: deleteExpense.isPending,
    isSavingMultiple: saveMultipleExpenses.isPending,
  };
};
