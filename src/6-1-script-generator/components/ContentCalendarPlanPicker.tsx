import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

const PLAN_PICKER_SELECT = `
  id, post_date, title,
  content_type:content_types(id, name),
  service:services(id, name),
  sub_service:sub_services(id, name),
  content_pillar:content_pillars(id, name, color),
  pic:employees!social_media_plans_pic_id_fkey(id, full_name)
`;

export interface PlanForPicker {
  id: string;
  post_date: string | null;
  title: string | null;
  content_type?: { id: string; name: string } | null;
  service?: { id: string; name: string } | null;
  sub_service?: { id: string; name: string } | null;
  content_pillar?: { id: string; name: string; color?: string } | null;
  pic?: { id: string; full_name: string } | null;
}

interface ContentCalendarPlanPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onSelect: (plan: PlanForPicker) => void;
}

export const ContentCalendarPlanPicker: React.FC<ContentCalendarPlanPickerProps> = ({
  open,
  onOpenChange,
  selectedDate,
  onDateChange,
  onSelect,
}) => {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();

  const { data: plans = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['social-media-plans-by-date', organizationId, selectedDate],
    queryFn: async () => {
      if (!organizationId || !selectedDate) return [];
      const { data, error } = await supabase
        .from('social_media_plans')
        .select(PLAN_PICKER_SELECT)
        .eq('organization_id', organizationId)
        .eq('post_date', selectedDate)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PlanForPicker[];
    },
    enabled: !!organizationId && !!selectedDate && open,
    refetchOnWindowFocus: false, // Dihilangkan: tidak refetch saat pindah window/tab
  });

  const handleRowClick = (plan: PlanForPicker) => {
    onSelect(plan);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{ zIndex: 999999 }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {t('scriptGenerator.saveToPlanModal.pickFromCalendar', 'Pick from Content Calendar')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-2">
            <label htmlFor="picker-date" className="text-sm font-medium whitespace-nowrap">
              {t('scriptGenerator.saveToPlanModal.postDate', 'Post Date')}
            </label>
            <input
              id="picker-date"
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-auto seamless-scroll border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center text-muted-foreground">
                <p>{error instanceof Error ? error.message : 'Gagal memuat daftar plan'}</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  {t('common.retry', 'Coba lagi')}
                </Button>
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('scriptGenerator.saveToPlanModal.noPlansForDate', 'No plans for this date')}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">{t('scriptGenerator.saveToPlanModal.postDate', 'Post Date')}</th>
                    <th className="text-left p-3 font-medium">{t('scriptGenerator.saveToPlanModal.pic', 'PIC')}</th>
                    <th className="text-left p-3 font-medium">{t('scriptGenerator.saveToPlanModal.contentType', 'Content Type')}</th>
                    <th className="text-left p-3 font-medium">{t('scriptGenerator.saveToPlanModal.service', 'Service')}</th>
                    <th className="text-left p-3 font-medium">{t('scriptGenerator.saveToPlanModal.subService', 'Sub Service')}</th>
                    <th className="text-left p-3 font-medium">{t('scriptGenerator.saveToPlanModal.titleField', 'Title')}</th>
                    <th className="text-left p-3 font-medium">{t('scriptGenerator.saveToPlanModal.contentPillar', 'Content Pillar')}</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr
                      key={plan.id}
                      onClick={() => handleRowClick(plan)}
                      className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        {plan.post_date ? format(new Date(plan.post_date), 'dd MMM yyyy') : '-'}
                      </td>
                      <td className="p-3">{plan.pic?.full_name ?? '-'}</td>
                      <td className="p-3">{plan.content_type?.name ?? '-'}</td>
                      <td className="p-3">{plan.service?.name ?? '-'}</td>
                      <td className="p-3">{plan.sub_service?.name ?? '-'}</td>
                      <td className="p-3 font-medium">{plan.title?.trim() || '-'}</td>
                      <td className="p-3">{plan.content_pillar?.name ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
