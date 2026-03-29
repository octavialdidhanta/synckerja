
import { useState } from "react";
import { useToast } from "@/shared/components/ui/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Department } from "./departmentTypes";
import { buildDepartmentQueryKey, fetchDepartments } from "./departmentUtils";
import { supabase } from "@/shared/lib/supabaseClient";

export function useDepartmentsCrud(
  orgId?: string
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = buildDepartmentQueryKey(orgId);

  const departmentsQuery = useQuery({
    queryKey,
    queryFn: () => fetchDepartments(),
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: 1000
  });

  // Store the full department objects (with isDefault property).
  const data: (Department & { isDefault?: boolean })[] | undefined = departmentsQuery.data?.map(dept => ({
    ...dept,
    isDefault: dept.is_default || dept.organization_id === null
  }));
  
  const isLoading: boolean = departmentsQuery.isLoading;
  const refetch: () => void = departmentsQuery.refetch;

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ id?: string; name: string; isDefault?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const openAddModal = () => {
    setEditItem({ name: "" });
    setModalOpen(true);
  };
  const openEditModal = (item: { id: string; name: string; isDefault?: boolean }) => {
    // Only prevent editing if it's a default item (organization_id = NULL)
    if (item.isDefault) return;
    setEditItem(item);
    setModalOpen(true);
  };
  const closeModal = () => {
    setEditItem(null);
    setModalOpen(false);
  };

  const saveItem = async (name: string) => {
    setSaving(true);
    try {
      if (!name) {
        toast({ title: "Name required", variant: "destructive" });
        setSaving(false);
        return;
      }
      // Prevent editing default departments (organization_id = NULL)
      if (editItem?.isDefault) {
        toast({ title: "Default departments cannot be edited", variant: "destructive" });
        setSaving(false);
        return;
      }
      if (editItem?.id) {
        const { error } = await supabase.from("departments").update({ name }).eq("id", editItem.id);
        if (error) throw error;
        toast({ title: "Updated successfully" });
      } else {
        let payload: { name: string; organization_id?: string } = { name, organization_id: orgId };
        const { error } = await supabase.from("departments").insert(payload);
        if (error) throw error;
        toast({ title: "Added successfully" });
      }
      closeModal();
      refetch();
      queryClient.invalidateQueries({ queryKey });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const deleteItem = async (id: string) => {
    const deptItem = data?.find((dept) => dept.id === id);
    // Prevent deleting default departments (organization_id = NULL)
    if (deptItem?.isDefault) {
      toast({ title: "Cannot delete default department", variant: "destructive" });
      return;
    }
    if (!window.confirm("Yakin hapus item ini?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted successfully" });
      closeModal();
      refetch();
      queryClient.invalidateQueries({ queryKey });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return {
    data,
    isLoading,
    modalOpen,
    editItem,
    openAddModal,
    openEditModal,
    closeModal,
    saveItem,
    deleteItem,
    saving,
    refetch,
  };
}
