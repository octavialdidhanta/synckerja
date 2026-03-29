
import { useState, useMemo } from "react";
import { useToast } from "@/shared/components/ui/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { JobOpening, JobOpeningFormData } from './jobOpeningTypes';
import { 
  buildJobOpeningQueryKey, 
  fetchJobOpenings, 
  createJobOpening, 
  updateJobOpening, 
  deleteJobOpening 
} from './jobOpeningUtils';

export function useJobOpeningsCrud() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => buildJobOpeningQueryKey(), []);

  const jobOpeningsQuery = useQuery({
    queryKey,
    queryFn: fetchJobOpenings,
    staleTime: 10 * 60 * 1000, // 10 minutes - data stays fresh longer
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1, // Reduce retry attempts
    retryDelay: 1000, // Faster retry
  });

  const data: JobOpening[] | undefined = jobOpeningsQuery.data;
  const isPending: boolean = jobOpeningsQuery.isPending;
  const isLoading: boolean = jobOpeningsQuery.isLoading;
  const refetch: () => void = jobOpeningsQuery.refetch;

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<(JobOpening & { isEdit?: boolean }) | null>(null);
  const [saving, setSaving] = useState(false);

  const openAddModal = useMemo(() => () => {
    setEditItem({
      id: '',
      job_title: '',
      department_id: '',
      job_position_id: '',
      job_level_id: '',
      employment_status_id: '',
      location: '',
      salary_min: 0,
      salary_max: 0,
      job_description: '',
      requirements: '',
      responsibilities: '',
      status: 'draft',
      isEdit: false
    } as JobOpening & { isEdit: boolean });
    setModalOpen(true);
  }, []);

  const openEditModal = useMemo(() => (item: JobOpening) => {
    setEditItem({ ...item, isEdit: true });
    setModalOpen(true);
  }, []);

  const closeModal = useMemo(() => () => {
    setEditItem(null);
    setModalOpen(false);
  }, []);

  const saveItem = useMemo(() => async (formData: JobOpeningFormData) => {
    setSaving(true);
    try {
      if (editItem?.isEdit && editItem?.id) {
        // Update existing job opening
        await updateJobOpening(editItem.id, formData);
        toast({ title: "Job opening updated successfully" });
      } else {
        // Create new job opening
        await createJobOpening(formData);
        toast({ title: "Job opening created successfully" });
      }
      
      closeModal();
      refetch();
      queryClient.invalidateQueries({ queryKey });
    } catch (e: any) {
      console.error('Error saving job opening:', e);
      toast({ 
        title: "Error", 
        description: e.message || 'Failed to save job opening', 
        variant: "destructive" 
      });
    }
    setSaving(false);
  }, [editItem, closeModal, refetch, queryClient, queryKey, toast]);

  const deleteItem = useMemo(() => async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this job opening?")) return;
    setSaving(true);
    try {
      await deleteJobOpening(id);
      toast({ title: "Job opening deleted successfully" });
      refetch();
      queryClient.invalidateQueries({ queryKey });
    } catch (e: any) {
      console.error('Error deleting job opening:', e);
      toast({ 
        title: "Error", 
        description: e.message || 'Failed to delete job opening', 
        variant: "destructive" 
      });
    }
    setSaving(false);
  }, [refetch, queryClient, queryKey, toast]);

  return {
    data,
    isPending,
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
