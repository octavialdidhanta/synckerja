import type { QueryKey } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { isEmployeeActive } from '@/2-1-employees/utils/employeeUtils';
import type { DigitalMarketingEmployee } from '../hook/useDigitalMarketingEmployees';
import type { SocialMediaLink } from '@/shared/types/social-media-links';

const CONTENT_PLANS_SELECT = `
  id,
  organization_id,
  post_date,
  content_type_id,
  pic_id,
  service_id,
  sub_service_id,
  title,
  content_pillar_id,
  brief,
  status,
  revision_count,
  approved,
  completion_date,
  pic_production_id,
  pic_production_source,
  google_drive_link,
  production_revision_baseline_link,
  production_status,
  production_revision_count,
  production_completion_date,
  production_approved,
  production_approved_date,
  post_link,
  post_link_created_by,
  done,
  actual_post_date,
  on_time_status,
  status_content,
  created_at,
  updated_at,
  content_type:content_types(id, name),
  service:services(id, name),
  sub_service:sub_services(id, name),
  content_pillar:content_pillars(id, name, color),
  pic:employees!social_media_plans_pic_id_fkey(id, full_name),
  pic_production:employees!social_media_plans_pic_production_id_fkey(id, full_name),
  post_link_creator:employees!social_media_plans_post_link_created_by_fkey(id, full_name)
`;

/** Initial load limit: smaller = faster first paint. Refresh fetches again with same limit. */
const INITIAL_PLANS_LIMIT = 200;

export function getContentPlansQueryOptions(organizationId: string | undefined) {
  return {
    queryKey: ['social-media-plans', organizationId || 'no-org'] as QueryKey,
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('social_media_plans')
        .select(CONTENT_PLANS_SELECT)
        .eq('organization_id', organizationId)
        .order('post_date', { ascending: false, nullsFirst: true })
        .order('created_at', { ascending: false })
        .limit(INITIAL_PLANS_LIMIT);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000, // 30s: revisits show cache immediately while refetch runs in background
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Selaras halaman tidak reload: tidak refetch massal saat remount/tab
    refetchInterval: false,
    retry: 1,
    retryDelay: (attemptIndex: number) => Math.min(500 * 2 ** attemptIndex, 5000),
  };
}

export function getMasterDataQueryOptions(organizationId: string | undefined) {
  return {
    queryKey: ['social-media-master', organizationId || 'no-org'] as QueryKey,
    queryFn: async () => {
      const [contentTypesResult, servicesResult, subServicesResult, contentPillarsResult] = await Promise.all([
        supabase
          .from('content_types')
          .select('id, name, is_active, organization_id')
          .or(organizationId ? `organization_id.eq.${organizationId},organization_id.is.null` : 'organization_id.is.null')
          .eq('is_active', true)
          .order('name')
          .limit(100),
        organizationId
          ? supabase
              .from('services')
              .select('id, name, is_active, organization_id')
              .eq('organization_id', organizationId)
              .eq('is_active', true)
              .order('name')
              .limit(100)
          : Promise.resolve({ data: [], error: null }),
        organizationId
          ? supabase
              .from('sub_services')
              .select('id, name, service_id, is_active, organization_id')
              .eq('organization_id', organizationId)
              .eq('is_active', true)
              .order('name')
              .limit(200)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('content_pillars')
          .select('id, name, is_active, organization_id, is_default, funnel_stage, description, category')
          .or(organizationId ? `is_default.eq.true,organization_id.eq.${organizationId}` : 'is_default.eq.true')
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .order('name')
          .limit(50),
      ]);
      if (contentTypesResult.error) throw contentTypesResult.error;
      if (servicesResult.error) throw servicesResult.error;
      if (subServicesResult.error) throw subServicesResult.error;
      if (contentPillarsResult.error) throw contentPillarsResult.error;
      return {
        contentTypes: contentTypesResult.data || [],
        services: servicesResult.data || [],
        subServices: subServicesResult.data || [],
        contentPillars: contentPillarsResult.data || [],
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
    retry: 2,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  };
}

interface RawEmployeeRow {
  id: string;
  full_name: string;
  email: string;
  user_id?: string;
  job_position_id?: string;
  job_positions?: { name?: string } | null;
  employee_status_id?: string | null;
  pending_removal?: boolean | null;
  employee_statuses?: { name?: string } | null;
}

export function getAllSocialMediaLinksQueryOptions(organizationId: string | undefined) {
  return {
    queryKey: ['all-social-media-links', organizationId] as QueryKey,
    queryFn: async (): Promise<SocialMediaLink[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase.from('social_media_links').select('*');
      if (error) throw error;
      return (data || []) as SocialMediaLink[];
    },
    enabled: !!organizationId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  };
}

export function buildLinksByPlanId(links: SocialMediaLink[]): Record<string, SocialMediaLink[]> {
  const map: Record<string, SocialMediaLink[]> = {};
  for (const link of links) {
    const planId = link.social_media_plan_id;
    if (!map[planId]) map[planId] = [];
    map[planId].push(link);
  }
  return map;
}

export function getDailyTasksRemindersQueryOptions(organizationId: string | undefined) {
  return {
    queryKey: ['daily-tasks-reminders', organizationId] as QueryKey,
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('id, title, description, due_date, finish_date, status')
        .eq('organization_id', organizationId)
        .eq('has_reminder', true)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) {
        console.error('Error fetching reminder tasks:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  };
}

export function getDigitalMarketingEmployeesQueryOptions(organizationId: string | undefined) {
  return {
    queryKey: ['digital-marketing-employees', organizationId] as QueryKey,
    queryFn: async (): Promise<DigitalMarketingEmployee[]> => {
      if (!organizationId) return [];
      type EmployeesResult = { data: RawEmployeeRow[] | null; error: Error | null };
      // Supabase relationship select causes TS "excessively deep" inference; we type the result explicitly
      // @ts-expect-error - complex select inference
      const result = await (supabase
        .from('employees')
        .select(
          'id, full_name, email, user_id, job_position_id, job_positions(name), employee_status_id, pending_removal, employee_statuses(name)'
        )
        .eq('organization_id', organizationId)
        .order('full_name') as unknown as Promise<EmployeesResult>);
      const { data, error } = result;
      if (error) throw error;
      const rows = data ?? [];
      const activeEmployees = rows.filter((emp) =>
        isEmployeeActive({
          employee_status_name: emp.employee_statuses?.name ?? null,
          pending_removal: emp.pending_removal ?? null,
        })
      );
      return activeEmployees.map((employee) => ({
        id: employee.id,
        full_name: employee.full_name,
        email: employee.email,
        job_position_name: employee.job_positions?.name || 'Unknown Position',
        job_position_id: employee.job_position_id,
        user_id: employee.user_id,
      }));
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
  };
}
