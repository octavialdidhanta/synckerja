
import { useState } from "react";
import { useToast } from "@/shared/components/ui/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { EmployeeStatus } from "./employeeStatusTypes";
import { buildEmployeeStatusQueryKey, fetchEmployeeStatuses } from "./employeeStatusUtils";
import { supabase } from "@/shared/lib/supabaseClient";

export function useEmployeeStatusesCrud(
  orgId?: string
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = buildEmployeeStatusQueryKey(orgId);

  const statusesQuery = useQuery({
    queryKey,
    queryFn: () => fetchEmployeeStatuses(),
  });
  
  const data: EmployeeStatus[] | undefined = statusesQuery.data?.map(status => ({
    ...status,
    isDefault: status.organization_id === null
  }));
  
  const isLoading: boolean = statusesQuery.isLoading;
  const refetch: () => void = statusesQuery.refetch;

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ id?: string; name: string; isDefault?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const openAddModal = () => {
    setEditItem({ name: "" });
    setModalOpen(true);
  };
  
  const openEditModal = (item: { id: string; name: string; isDefault?: boolean }) => {
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
      
      if (editItem?.isDefault) {
        toast({ title: "Cannot edit default employee statuses", variant: "destructive" });
        setSaving(false);
        return;
      }
      
      if (editItem?.id) {
        const { error } = await supabase.from("employee_statuses").update({ name }).eq("id", editItem.id);
        if (error) throw error;
        toast({ title: "Updated successfully" });
      } else {
        let payload: { name: string; organization_id?: string } = { name, organization_id: orgId };
        const { error } = await supabase.from("employee_statuses").insert(payload);
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
    const selectedItem = data?.find((s) => s.id === id);
    if (selectedItem?.isDefault) {
      toast({ title: "Cannot delete default employee statuses", variant: "destructive" });
      return;
    }
    if (!window.confirm("Yakin hapus item ini?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("employee_statuses").delete().eq("id", id);
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
