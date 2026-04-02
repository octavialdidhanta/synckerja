
import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export const useCompanyLogo = () => {
  const { organizationId } = useCurrentOrg();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (organizationId) {
      fetchLogo();
    }
  }, [organizationId]);

  const fetchLogo = async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('logo_url')
        .eq('id', organizationId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setLogoUrl(data?.logo_url || null);
    } catch (err) {
      console.error('Error fetching company logo:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateLogo = (newLogoUrl: string | null) => {
    setLogoUrl(newLogoUrl);
  };

  return {
    logoUrl,
    loading,
    updateLogo,
    refetch: fetchLogo
  };
};
