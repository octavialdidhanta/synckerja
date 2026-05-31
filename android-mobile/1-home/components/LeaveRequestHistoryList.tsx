import { Loader2 } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/mobile-app/components/ui/card';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { EmployeeLeaveRequestData } from '@/2-1-employees/MyInfo/LeavePermit/hooks/useEmployeeLeaveRequests';
import {
  formatLeaveRequestStatusLabel,
  formatLeaveTypeLabel,
} from '@/shared/leave/leaveRequestTypes';

interface LeaveRequestHistoryListProps {
  requests: EmployeeLeaveRequestData[];
  loading: boolean;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'approved':
      return 'border-brand-blue/30 bg-brand-blue/10 text-brand-blue';
    case 'rejected':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'cancelled':
      return 'border-border bg-muted text-muted-foreground';
    default:
      return 'border-yellow-200 bg-yellow-50 text-yellow-700';
  }
}

function formatDateRange(start: string, end: string, language: string): string {
  const locale = language === 'id' ? 'id-ID' : 'en-US';
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start} – ${end}`;
  }

  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${startDate.toLocaleDateString(locale, opts)} – ${endDate.toLocaleDateString(locale, opts)}`;
}

export const LeaveRequestHistoryList = ({ requests, loading }: LeaveRequestHistoryListProps) => {
  const { t } = useAppTranslation();
  const { language } = useLanguage();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Card className="border border-border bg-gradient-card">
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t('leaveHistory.noRequestHistory', 'No leave request history')}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {requests.map((request) => (
        <Card key={request.id} className="border border-border bg-gradient-card">
          <div className="space-y-2 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {formatLeaveTypeLabel(request.leave_type, t)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateRange(request.start_date, request.end_date, language)}
                </p>
              </div>
              <Badge variant="outline" className={`shrink-0 text-xs ${getStatusBadgeClass(request.status)}`}>
                {formatLeaveRequestStatusLabel(request.status, t)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {applyVariables(t('leaveRequest.totalLeaveDays', 'Total leave days: {{days}} days'), {
                days: String(request.total_days),
              })}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
};
