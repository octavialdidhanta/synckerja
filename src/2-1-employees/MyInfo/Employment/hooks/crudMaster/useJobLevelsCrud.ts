
import { useState } from "react";
import { useToast } from "@/shared/components/ui/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { attendanceHRQueryDefaults } from "@/shared/lib/attendanceHRQueryDefaults";
import type { JobLevel } from "./jobLevelTypes";
import { buildJobLevelQueryKey, fetchJobLevels } from "./jobLevelUtils";
import { supabase } from "@/shared/lib/supabaseClient";
import type { MasterCrudQueryOptions } from "./useDepartmentsCrud";

export function useJobLevelsCrud(orgId?: string, queryOptions?: MasterCrudQueryOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = buildJobLevelQueryKey(orgId);

  const jobLevelsQuery = useQuery({
    queryKey,
    queryFn: () => fetchJobLevels(),
    ...(queryOptions?.sessionCache ? attendanceHRQueryDefaults : {}),
  });
  
  const data: JobLevel[] | undefined = jobLevelsQuery.data?.map(jl => ({
    ...jl,
    isDefault: jl.organization_id === null
  }));
  
  const isLoading: boolean = jobLevelsQuery.isLoading;
  const refetch: () => void = jobLevelsQuery.refetch;

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<JobLevel | null>(null);
  const [saving, setSaving] = useState(false);

  const openAddModal = () => {
    setEditItem({ name: "" } as JobLevel);
    setModalOpen(true);
  };
  const openEditModal = (item: JobLevel) => {
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
      // Prevent editing default job levels (organization_id = NULL)
      if (editItem?.isDefault) {
        toast({ title: "Cannot edit default job levels", variant: "destructive" });
        setSaving(false);
        return;
      }
      if (editItem?.id) {
        const { error } = await supabase
          .from("job_levels")
          .update({ name })
          .eq("id", editItem.id);
        if (error) throw error;
        toast({ title: "Updated successfully" });
      } else {
        let payload: { name: string; organization_id?: string } = { name, organization_id: orgId };
        const { error } = await supabase.from("job_levels").insert(payload);
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
    // Prevent deleting default job levels (organization_id = NULL)
    const selectedItem = data?.find((jl) => jl.id === id);
    if (selectedItem?.isDefault) {
      toast({ title: "Cannot delete default job levels", variant: "destructive" });
      return;
    }
    if (!window.confirm("Yakin hapus item ini?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("job_levels").delete().eq("id", id);
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
