import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import type { OrganizationFormData } from '@/2-8-organization/components/create-organization/types';
import { validateFormData } from '@/2-8-organization/components/create-organization/validation';

const USER_ORGS_QUERY_KEY = ['user-organizations'] as const;

export function useOrganizationCreation() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const createOrganization = useCallback(
    async (formData: OrganizationFormData): Promise<boolean> => {
      setError(null);
      setProgress(null);

      if (!formData.terms_accepted) {
        setError('Anda harus menyetujui syarat dan ketentuan');
        return false;
      }

      const validationError = validateFormData(formData);
      if (validationError) {
        setError(validationError);
        return false;
      }

      setLoading(true);
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          setError('Silakan masuk terlebih dahulu');
          return false;
        }

        setProgress('Membuat organisasi…');
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .insert({
            user_id: user.id,
            created_by: user.id,
            company_name: formData.company_name.trim(),
            industry: formData.industry,
            employee_count: formData.company_size,
            address: formData.address.trim(),
            phone_number: formData.phone_number.trim(),
            website: formData.website.trim() || null,
            description: formData.description.trim() || null,
            terms_accepted: true,
            terms_accepted_at: new Date().toISOString(),
            email: user.email ?? null,
          })
          .select('id')
          .single();

        if (orgError) throw orgError;
        if (!org?.id) throw new Error('Organisasi tidak berhasil dibuat');

        const organizationId = org.id;

        setProgress('Menautkan akun Anda…');
        const { error: uoError } = await supabase.from('user_organizations').insert({
          user_id: user.id,
          organization_id: organizationId,
          is_active: true,
        });
        if (uoError) throw uoError;

        const { error: roleError } = await supabase.from('user_roles').insert({
          user_id: user.id,
          organization_id: organizationId,
          role: 'owner',
        });
        if (roleError) throw roleError;

        setProgress('Mengatur organisasi aktif…');
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            active_organization_id: organizationId,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        if (profileError) throw profileError;

        try {
          sessionStorage.setItem('newOrganizationId', organizationId);
        } catch {
          /* ignore */
        }

        await queryClient.invalidateQueries({ queryKey: USER_ORGS_QUERY_KEY });
        await queryClient.invalidateQueries({ queryKey: ['profile'] });

        setProgress(null);
        return true;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Gagal membuat organisasi';
        setError(message);
        setProgress(null);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient],
  );

  return { loading, error, progress, createOrganization };
}
