
import { useState } from "react";
import { useToast } from "@/shared/components/ui/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Branch } from "./branchTypes";
import { buildBranchQueryKey, fetchBranches } from "./branchUtils";
import { supabase } from "@/shared/lib/supabaseClient";

export function useBranchesCrud(
  orgId?: string
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = buildBranchQueryKey(orgId);

  const branchesQuery = useQuery({
    queryKey,
    queryFn: () => fetchBranches(),
  });
  
  const data: Branch[] | undefined = branchesQuery.data?.map(branch => ({
    ...branch,
    isDefault: branch.organization_id === null
  }));
  
  const isLoading: boolean = branchesQuery.isLoading;
  const refetch: () => void = branchesQuery.refetch;

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
      // Prevent editing default branches (organization_id = NULL)
      if (editItem?.isDefault) {
        toast({ title: "Cannot edit default branches", variant: "destructive" });
        setSaving(false);
        return;
      }
      if (editItem?.id) {
        const { error } = await supabase.from("branches").update({ name }).eq("id", editItem.id);
        if (error) throw error;
        toast({ title: "Updated successfully" });
      } else {
        let payload: { name: string; organization_id?: string } = { name, organization_id: orgId };
        const { error } = await supabase.from("branches").insert(payload);
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
    const selectedItem = data?.find((b) => b.id === id);
    // Prevent deleting default branches (organization_id = NULL)
    if (selectedItem?.isDefault) {
      toast({ title: "Cannot delete default branches", variant: "destructive" });
      return;
    }
    if (!window.confirm("Yakin hapus item ini?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("branches").delete().eq("id", id);
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
