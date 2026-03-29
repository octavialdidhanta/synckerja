import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useEmployeeLeaveEligibility } from '../hooks/useEmployeeLeaveEligibility';
import { format } from 'date-fns';
import { id, enUS } from 'date-fns/locale';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';

export const LeaveEligibilityAlert = () => {
  const { t, dateFnsLocale } = useAppTranslation();
  const { data: eligibility, isLoading } = useEmployeeLeaveEligibility();

  if (isLoading) {
    return (
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertDescription>
          {t('leaveEligibility.loading', 'Loading leave eligibility information...')}
        </AlertDescription>
      </Alert>
    );
  }

  if (!eligibility) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          {t('leaveEligibility.loadError', 'Unable to load leave eligibility information')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {/* Eligibility Status */}
      <Alert variant={eligibility.isEligible ? "default" : "destructive"}>
        {eligibility.isEligible ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        <AlertDescription className="flex items-center justify-between">
          <span>{eligibility.message}</span>
          <Badge variant={eligibility.isEligible ? "default" : "secondary"}>
            {eligibility.isEligible ? t('leaveEligibility.eligible', 'Eligible for Leave') : t('leaveEligibility.notEligible', 'Not Eligible')}
          </Badge>
        </AlertDescription>
      </Alert>

      {/* Leave Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-1">
            <Calendar className="h-4 w-4" />
            {t('profile.remainingLeave', 'Remaining Leave')}
          </div>
          <p className="text-2xl font-bold">
            {applyVariables(t('leaveEligibility.days', '{{days}} days'), { days: String(eligibility.remainingDays) })}
          </p>
          <p className="text-sm text-muted-foreground">
            {applyVariables(t('profile.leaveBalance', '{{remaining}} days from {{total}} days/year'), {
              remaining: String(eligibility.remainingDays),
              total: String(eligibility.annualLeaveEntitlement)
            })}
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-1">
            <Clock className="h-4 w-4" />
            {t('leaveEligibility.strategy', 'Leave Strategy')}
          </div>
          <p className="text-sm">
            {eligibility.strategy === 'after_probation' 
              ? t('leaveEligibility.afterProbation', 'After Probation') 
              : t('leaveEligibility.afterWorkPeriod', 'After Work Period')
            }
          </p>
        </div>

        {eligibility.eligibilityDate && (
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <Calendar className="h-4 w-4" />
              {t('leaveEligibility.eligibilityDate', 'Leave Eligibility Date')}
            </div>
            <p className="text-sm">
              {format(eligibility.eligibilityDate, "dd MMM yyyy", { locale: dateFnsLocale })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

