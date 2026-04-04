import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export type ScriptGeneratorMasterRow = {
  id: string;
  name: string;
  [key: string]: unknown;
};

export type ScriptGeneratorFormMasterData = {
  contentTypes: ScriptGeneratorMasterRow[];
  services: ScriptGeneratorMasterRow[];
  subServices: ScriptGeneratorMasterRow[];
  contentPillars: ScriptGeneratorMasterRow[];
};

/**
 * Master selects untuk ScriptGeneratorForm (satu query agar bisa diagregasi ke page skeleton gate).
 */
export function useScriptGeneratorFormMasterData() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['script-generator-form-master', organizationId],
    queryFn: async (): Promise<ScriptGeneratorFormMasterData> => {
      if (!organizationId) {
        return { contentTypes: [], services: [], subServices: [], contentPillars: [] };
      }

      const [contentTypesResult, servicesResult, subServicesResult, contentPillarsResult] = await Promise.all([
        supabase
          .from('content_types')
          .select('*')
          .or(`organization_id.eq.${organizationId},organization_id.is.null`)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('services')
          .select('*')
          .or(`organization_id.eq.${organizationId},organization_id.is.null`)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('sub_services')
          .select('*')
          .or(`organization_id.eq.${organizationId},organization_id.is.null`)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('content_pillars')
          .select('*')
          .or(`organization_id.eq.${organizationId},organization_id.is.null`)
          .eq('is_active', true)
          .order('name'),
      ]);

      const ctErr = contentTypesResult.error;
      const svcErr = servicesResult.error;
      const subErr = subServicesResult.error;
      const cpErr = contentPillarsResult.error;
      if (ctErr || svcErr || subErr || cpErr) {
        const msg =
          ctErr?.message || svcErr?.message || subErr?.message || cpErr?.message || 'Gagal memuat data';
        throw new Error(msg);
      }

      const filterNamed = (rows: unknown[] | null, requireId?: boolean) =>
        (rows || []).filter((row: any) => {
          if (!row?.name || typeof row.name !== 'string' || row.name.trim() === '') return false;
          if (requireId && !row?.id) return false;
          return true;
        }) as ScriptGeneratorMasterRow[];

      return {
        contentTypes: filterNamed(contentTypesResult.data || []),
        services: filterNamed(servicesResult.data || [], true),
        subServices: filterNamed(subServicesResult.data || [], true),
        contentPillars: filterNamed(contentPillarsResult.data || []),
      };
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
