
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { toast } from 'sonner';

export interface FaceRegistration {
  id: string;
  employee_id: string;
  organization_id: string;
  face_encoding: string;
  face_image_url: string | null;
  is_active: boolean;
  confidence_threshold: number;
  created_at: string;
  updated_at: string;
}

export const useEnhancedFaceRegistration = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { data: currentEmployee } = useCurrentEmployee();
  const [loading, setLoading] = useState(false);

  const employeeId = (currentEmployee as { id?: string } | null)?.id ?? null;
  const employeeUserId = (currentEmployee as { user_id?: string } | null)?.user_id ?? null;

  // Fetch face registrations
  const { data: registrations = [], refetch: fetchRegistrations } = useQuery({
    queryKey: ['face-registrations', employeeId, organizationId],
    queryFn: async () => {
      if (!employeeId || !organizationId) {
        return [];
      }

      const { data, error } = await supabase
        .from('employee_face_registrations')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .returns<FaceRegistration[]>();

      if (error) {
        console.error('Error fetching face registrations:', error);
        throw error;
      }

      return (data ?? []) as FaceRegistration[];
    },
    enabled: !!employeeId && !!organizationId,
  });

  // Register face mutation
  const registerFaceMutation = useMutation({
    mutationFn: async ({ encoding, imageData }: { encoding: string; imageData: string }) => {
      if (!employeeId || !organizationId) {
        throw new Error('Employee or organization not found');
      }

      setLoading(true);

      try {
        // Upload image to storage if needed
        let imageUrl: string | null = null;
        
        // For now, we'll store the encoding directly
        // In production, you might want to upload the image to storage first
        
        // Check if registration already exists
        const { data: existingData } = await supabase
          .from('employee_face_registrations')
          .select('id')
          .eq('employee_id', employeeId)
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .returns<Pick<FaceRegistration, 'id'>>()
          .maybeSingle();

        const existing = existingData as Pick<FaceRegistration, 'id'> | null;

        let result;
        if (existing) {
          const existingId = existing.id;
          // Update existing registration
          const { data, error } = await supabase
            .from('employee_face_registrations')
            .update({
              face_encoding: encoding,
              face_image_url: imageUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingId)
            .select()
            .returns<FaceRegistration>()
            .single();

          if (error) throw error;
          result = data as FaceRegistration;
        } else {
          // Create new registration
          const { data, error } = await supabase
            .from('employee_face_registrations')
            .insert({
              employee_id: employeeId,
              organization_id: organizationId,
              face_encoding: encoding,
              face_image_url: imageUrl,
              is_active: true,
              confidence_threshold: 0.8,
              created_by: employeeUserId,
            })
            .select()
            .returns<FaceRegistration>()
            .single();

          if (error) throw error;
          result = data as FaceRegistration;
        }

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ['face-registrations'] });

        toast.success('Face registered successfully');
        return result as FaceRegistration;
      } catch (error: any) {
        console.error('Face registration error:', error);
        toast.error(error.message || 'Failed to register face');
        throw error;
      } finally {
        setLoading(false);
      }
    },
  });

  // Register face function
  const registerFace = useCallback(
    async (encoding: string, imageData: string) => {
      return registerFaceMutation.mutateAsync({ encoding, imageData });
    },
    [registerFaceMutation]
  );

  // Check face registration
  const checkFaceRegistration = useCallback(async (): Promise<boolean> => {
    if (!employeeId || !organizationId) {
      return false;
    }

    const { data, error } = await supabase
      .from('employee_face_registrations')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .returns<Pick<FaceRegistration, 'id'>>()
      .maybeSingle();

    if (error) {
      console.error('Error checking face registration:', error);
      return false;
    }

    const record = data as Pick<FaceRegistration, 'id'> | null;
    return !!record;
  }, [employeeId, organizationId]);

  return {
    loading: loading || registerFaceMutation.isPending,
    registrations,
    registerFace,
    fetchRegistrations,
    checkFaceRegistration,
  };
};


