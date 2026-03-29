
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar';
import { AlertTriangle, Eye, MoreHorizontal } from 'lucide-react';
import { useAttendancePenalties } from './hooks/useAttendancePenalties';
import { formatDistanceToNow, format } from 'date-fns';
import { id, enUS } from 'date-fns/locale';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';

export const RecentPenaltiesWidget = () => {
  const { penalties, loading } = useAttendancePenalties();
  const { t, language } = useAppTranslation();
  const dateLocale = language === 'id' ? id : enUS;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t('penalties.recent.title', 'Recent Penalties')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-2 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mt-1"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get recent penalties (last 5)
  const recentPenalties = penalties
    .sort((a, b) => new Date(b.applied_date).getTime() - new Date(a.applied_date).getTime())
    .slice(0, 5);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'destructive';
      case 'waived': return 'secondary';
      case 'appealed': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'waived': return 'Waived';
      case 'appealed': return 'Appealed';
      default: return status;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          {t('penalties.recent.title', 'Recent Penalties')}
        </CardTitle>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4 mr-1" />
          {t('penalties.recent.viewAll', 'View All')}
        </Button>
      </CardHeader>
      <CardContent className="flex-1">
        {recentPenalties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>{t('penalties.recent.noPenalties', 'No recent penalties')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentPenalties.map((penalty) => (
              <div key={penalty.id} className="flex items-start space-x-2 p-2 rounded-lg border bg-gray-50">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-red-100 text-red-600">
                    {penalty.employees?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {penalty.employees?.full_name || 'Unknown Employee'}
                    </p>
                    <Badge variant={getStatusColor(penalty.status)} className="text-xs">
                      {getStatusLabel(penalty.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {(() => {
                      // Parse penalty_reason which might be in format "Keterlambatan X menit pada YYYY-MM-DD"
                      const reason = penalty.penalty_reason || '';
                      const lateMatch = reason.match(/Keterlambatan\s+(\d+)\s+menit\s+pada\s+(\d{4}-\d{2}-\d{2})/i);
                      
                      if (lateMatch) {
                        const minutes = lateMatch[1];
                        const dateStr = lateMatch[2];
                        const formattedDate = format(new Date(dateStr), 'yyyy-MM-dd');
                        return applyVariables(
                          t('penalties.lateReason', 'Late {{minutes}} minutes on {{date}}'),
                          { minutes, date: formattedDate }
                        );
                      }
                      return reason;
                    })()}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-medium text-red-600">
                      Rp {penalty.penalty_amount.toLocaleString('id-ID')}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(penalty.applied_date), { 
                        addSuffix: true,
                        locale: dateLocale 
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
