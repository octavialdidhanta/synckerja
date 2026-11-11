import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAuth } from '@/shared/auth/contexts/AuthContext';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export interface ProductionNeedReviewItem {
  notificationId: string;
  planId: string;
  title: string;
  picName: string;
}

type PlanEmbed = {
  id: string;
  title: string | null;
  production_status: string | null;
  production_approved: boolean | null;
  pic_production: { full_name: string | null } | { full_name: string | null }[] | null;
};

type NotificationEmbed = {
  id: string;
  social_media_plan_id: string;
  created_at: string;
  social_media_plans: PlanEmbed | PlanEmbed[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function stillNeedsManagerReview(plan: PlanEmbed | null): boolean {
  if (!plan || plan.production_approved === true) return false;
  const status = (plan.production_status ?? '').trim().toLowerCase();
  return status === '' || status === 'need review';
}

/**
 * Content plans whose PIC Production manager should review them.
 * These are not daily-task completion approvals. The row stays until production
 * leaves Need Review (approved, or moved to Request Revision).
 */
export function useProductionNeedReviewItems() {
  const { user } = useAuth();
  const { organizationId } = useCurrentOrg();
  const [items, setItems] = useState<ProductionNeedReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!user?.id || !organizationId) {
      if (mountedRef.current) {
        setItems([]);
        setLoading(false);
      }
      return;
    }
    if (mountedRef.current) setLoading(true);
    const { data, error } = await supabase
      .from('social_media_production_notifications')
      .select(
        `id, social_media_plan_id, created_at,
         social_media_plans!inner(
           id, title, production_status, production_approved,
           pic_production:employees!social_media_plans_pic_production_id_fkey(full_name)
         )`,
      )
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .eq('event_type', 'need_review')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!mountedRef.current) return;
    if (error) {
      console.warn('[useProductionNeedReviewItems]', error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    const seen = new Set<string>();
    const next: ProductionNeedReviewItem[] = [];
    for (const row of (data ?? []) as unknown as NotificationEmbed[]) {
      const plan = one(row.social_media_plans);
      if (!stillNeedsManagerReview(plan) || !plan) continue;
      if (seen.has(plan.id)) continue;
      seen.add(plan.id);
      const pic = one(plan.pic_production);
      next.push({
        notificationId: row.id,
        planId: plan.id,
        title: (plan.title ?? '').trim() || 'Konten',
        picName: (pic?.full_name ?? '').trim() || 'PIC',
      });
    }
    setItems(next);
    setLoading(false);
  }, [organizationId, user?.id]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  return { items, loading, refresh };
}
