import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import type {
  DigitalAssetCharacter,
  DigitalAssetCharacterImage,
  DigitalAssetObject,
  DigitalAssetBrandColor,
  DigitalAssetCompanyLogo,
} from '../types/digitalAssetRecords';

export const digitalAssetCharactersKey = (organizationId: string | null | undefined) =>
  ['digital_asset_characters', organizationId] as const;

export const digitalAssetCharacterImagesKey = (
  organizationId: string | null | undefined,
  characterId: string | null | undefined,
) => ['digital_asset_character_images', organizationId, characterId] as const;

export const digitalAssetCharacterPoseCountsKey = (
  organizationId: string | null | undefined,
  characterIds: string[],
) =>
  [
    'digital_asset_character_pose_counts',
    organizationId,
    [...characterIds].sort().join(','),
  ] as const;

export const digitalAssetObjectsKey = (organizationId: string | null | undefined) =>
  ['digital_asset_objects', organizationId] as const;

export const digitalAssetBrandColorsKey = (organizationId: string | null | undefined) =>
  ['digital_asset_brand_colors', organizationId] as const;

export const digitalAssetCompanyLogosKey = (organizationId: string | null | undefined) =>
  ['digital_asset_company_logos', organizationId] as const;

export function useDigitalAssetCharactersListQuery() {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    queryKey: digitalAssetCharactersKey(organizationId),
    queryFn: async (): Promise<DigitalAssetCharacter[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('digital_asset_characters')
        .select('*')
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as DigitalAssetCharacter[]) || [];
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useDigitalAssetCharacterImagesQuery(characterId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    queryKey: digitalAssetCharacterImagesKey(organizationId, characterId),
    queryFn: async (): Promise<DigitalAssetCharacterImage[]> => {
      if (!organizationId || !characterId) return [];
      const { data, error } = await supabase
        .from('digital_asset_character_images')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('character_id', characterId)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as DigitalAssetCharacterImage[]) || [];
    },
    enabled: !!organizationId && !!characterId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Total pose image rows across multiple characters (for Brief scene hint). */
export function useDigitalAssetCharacterPoseCountQuery(characterIds: string[]) {
  const { organizationId } = useCurrentOrg();
  const ids = [...new Set(characterIds.filter(Boolean))];
  return useQuery({
    queryKey: digitalAssetCharacterPoseCountsKey(organizationId, ids),
    queryFn: async (): Promise<number> => {
      if (!organizationId || ids.length === 0) return 0;
      const { count, error } = await supabase
        .from('digital_asset_character_images')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .in('character_id', ids);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!organizationId && ids.length > 0,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useDigitalAssetObjectsListQuery() {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    queryKey: digitalAssetObjectsKey(organizationId),
    queryFn: async (): Promise<DigitalAssetObject[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('digital_asset_objects')
        .select('*')
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as DigitalAssetObject[]) || [];
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useDigitalAssetBrandColorsListQuery() {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    queryKey: digitalAssetBrandColorsKey(organizationId),
    queryFn: async (): Promise<DigitalAssetBrandColor[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('digital_asset_brand_colors')
        .select('*')
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as DigitalAssetBrandColor[]) || [];
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useDigitalAssetCompanyLogosListQuery() {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    queryKey: digitalAssetCompanyLogosKey(organizationId),
    queryFn: async (): Promise<DigitalAssetCompanyLogo[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('digital_asset_company_logos')
        .select('*')
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as DigitalAssetCompanyLogo[]) || [];
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
