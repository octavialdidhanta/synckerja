
import { useState } from "react";
import { useToast } from "@/shared/components/ui/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { attendanceHRQueryDefaults } from "@/shared/lib/attendanceHRQueryDefaults";
import type { JobPosition } from "./jobPositionTypes";
import { buildJobPositionQueryKey, fetchJobPositions } from "./jobPositionUtils";
import { supabase } from "@/shared/lib/supabaseClient";
import type { MasterCrudQueryOptions } from "./useDepartmentsCrud";

export function useJobPositionsCrud(
  orgId?: string,
  extraFilter?: Record<string, string | number | boolean | undefined>,
  queryOptions?: MasterCrudQueryOptions,
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = buildJobPositionQueryKey(orgId);

  const jobPositionsQuery = useQuery({
    queryKey: ["job_positions", orgId, extraFilter?.department_id],
    queryFn: () => fetchJobPositions(extraFilter?.department_id as string),
    ...(queryOptions?.sessionCache
      ? attendanceHRQueryDefaults
      : {
          staleTime: 5 * 60 * 1000,
          gcTime: 10 * 60 * 1000,
        }),
  });
  
  // Filter by extraFilter if provided, but don't apply organization filtering here
  const data: JobPosition[] | undefined = jobPositionsQuery.data?.map(jp => ({
    ...jp,
    isDefault: jp.organization_id === null
  }));
  
  const isLoading: boolean = jobPositionsQuery.isLoading;
  const refetch: () => void = jobPositionsQuery.refetch;

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<JobPosition | null>(null);
  const [saving, setSaving] = useState(false);

  const openAddModal = () => {
    setEditItem({ name: "" } as JobPosition);
    setModalOpen(true);
  };
  const openEditModal = (item: JobPosition) => {
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
      // Prevent editing default job positions (organization_id = NULL)
      if (editItem?.isDefault) {
        toast({ title: "Cannot edit default job positions", variant: "destructive" });
        setSaving(false);
        return;
      }
      if (editItem?.id) {
        const { error } = await supabase
          .from("job_positions")
          .update({ name })
          .eq("id", editItem.id);
        if (error) throw error;
        toast({ title: "Updated successfully" });
      } else {
        // New item: always assign org id
        let payload: { name: string; organization_id?: string; department_id?: string } = { name, organization_id: orgId };
        if (extraFilter) payload = { ...payload, ...extraFilter };
        const { error } = await supabase.from("job_positions").insert(payload);
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
    // Prevent deleting default job positions (organization_id = NULL)
    const selectedItem = data?.find((jp) => jp.id === id);
    if (selectedItem?.isDefault) {
      toast({ title: "Cannot delete default job positions", variant: "destructive" });
      return;
    }
    if (!window.confirm("Yakin hapus item ini?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("job_positions").delete().eq("id", id);
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
