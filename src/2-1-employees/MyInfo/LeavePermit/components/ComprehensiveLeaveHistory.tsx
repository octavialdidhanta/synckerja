import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { 
  Calendar, 
  Clock, 
  Gift, 
  TrendingUp, 
  FileCheck,
  Users,
  AlertCircle,
  CheckCircle,
  XCircle,
  Hourglass,
  Info,
  CalendarDays
} from 'lucide-react';
import { Label } from '@/shared/components/ui/label';
import { InfoTooltip } from './info-tooltip';
import { format } from 'date-fns';
import { id, enUS } from 'date-fns/locale';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';
import { useEmployeeLeaveRequests } from '../hooks/useEmployeeLeaveRequests';
import { useEmployeeLeaveAllocations } from '../hooks/useEmployeeLeaveAllocations';
import { useLeavePolicy } from '../hooks/useLeavePolicy';
import { useEmployeeLeaveBalance } from '../hooks/useEmployeeLeaveBalance';
import { parseDateFromDatabase } from '../utils/dateUtils';

interface ComprehensiveLeaveHistoryProps {
  employeeId: string;
  organizationId: string;
}

export const ComprehensiveLeaveHistory = ({ employeeId, organizationId }: ComprehensiveLeaveHistoryProps) => {
  const { t, dateFnsLocale } = useAppTranslation();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: leaveRequests = [], isLoading: requestsLoading } = useEmployeeLeaveRequests({
    employeeId,
    status: statusFilter,
    year: selectedYear
  });

  const { data: leaveAllocations = [], isLoading: allocationsLoading } = useEmployeeLeaveAllocations(employeeId);
  const { data: leavePolicy, isLoading: policyLoading } = useLeavePolicy(organizationId);
  const { data: leaveBalance, isLoading: balanceLoading } = useEmployeeLeaveBalance();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Hourglass className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: t('leaveHistory.pending', 'Pending'), variant: 'secondary' as const },
      approved: { label: t('leaveHistory.approved', 'Approved'), variant: 'default' as const },
      rejected: { label: t('leaveHistory.rejected', 'Rejected'), variant: 'destructive' as const },
      cancelled: { label: t('leaveHistory.cancelled', 'Cancelled'), variant: 'outline' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getLeaveTypeLabel = (type: string) => {
    const typeLabels = {
      annual: t('leaveHistory.leaveType.annual', 'Annual Leave'),
      sick: t('leaveHistory.leaveType.sick', 'Sick Leave'), 
      maternity: t('leaveHistory.leaveType.maternity', 'Maternity Leave'),
      paternity: t('leaveHistory.leaveType.paternity', 'Paternity Leave'),
      personal: t('leaveHistory.leaveType.personal', 'Personal Leave'),
      emergency: t('leaveHistory.leaveType.emergency', 'Emergency Leave'),
      unpaid: t('leaveHistory.leaveType.unpaid', 'Unpaid Leave'),
    };
    
    return typeLabels[type as keyof typeof typeLabels] || type;
  };

  const getAllocationIcon = (type: string) => {
    switch (type) {
      case 'annual_grant':
        return <Calendar className="h-4 w-4" />;
      case 'bonus':
        return <Gift className="h-4 w-4" />;
      case 'carry_over':
        return <TrendingUp className="h-4 w-4" />;
      case 'manual_adjustment':
        return <Clock className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getAllocationTypeLabel = (type: string) => {
    switch (type) {
      case 'annual_grant':
        return t('leaveHistory.allocationType.annualGrant', 'Annual Leave');
      case 'bonus':
        return t('leaveHistory.allocationType.bonus', 'Bonus Leave');
      case 'carry_over':
        return t('leaveHistory.allocationType.carryOver', 'Carry Over');
      case 'manual_adjustment':
        return t('leaveHistory.allocationType.manualAdjustment', 'Manual Adjustment');
      default:
        return type;
    }
  };

  // Calculate statistics
  const totalDaysUsed = leaveRequests
    .filter(req => req.status === 'approved')
    .reduce((sum, req) => sum + req.total_days, 0);
  
  const pendingDays = leaveRequests
    .filter(req => req.status === 'pending')
    .reduce((sum, req) => sum + req.total_days, 0);

  const totalAllocated = leaveAllocations?.reduce((sum, allocation) => sum + allocation.days_allocated, 0) || 0;

  const expiredAllocations = leaveAllocations?.filter(allocation => 
    allocation.expires_at && new Date(allocation.expires_at) < new Date()
  ) || [];
  
  const expiredDays = expiredAllocations.reduce((sum, allocation) => sum + allocation.days_allocated, 0);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (requestsLoading || allocationsLoading || policyLoading || balanceLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">{t('leaveHistory.loading', 'Loading leave history...')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('leaveHistory.remainingLeave', 'Remaining Leave')}</p>
                <p className="text-2xl font-bold">{leaveBalance?.remainingLeave || 0}</p>
                <p className="text-xs text-muted-foreground">{t('leaveHistory.days', 'days')}</p>
              </div>
              <Calendar className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('leaveHistory.usedLeave', 'Used Leave')}</p>
                <p className="text-2xl font-bold">{totalDaysUsed}</p>
                <p className="text-xs text-muted-foreground">{t('leaveHistory.daysThisYear', 'days this year')}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('leaveHistory.pending', 'Pending')}</p>
                <p className="text-2xl font-bold">{pendingDays}</p>
                <p className="text-xs text-muted-foreground">{t('leaveHistory.days', 'days')}</p>
              </div>
              <Hourglass className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('leaveHistory.totalAllocation', 'Total Allocation')}</p>
                <p className="text-2xl font-bold">{totalAllocated}</p>
                <p className="text-xs text-muted-foreground">{t('leaveHistory.days', 'days')}</p>
              </div>
              <Gift className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="requests">{t('leaveHistory.requestHistory', 'Request History')}</TabsTrigger>
          <TabsTrigger value="allocations">{t('leaveHistory.leaveAllocation', 'Leave Allocation')}</TabsTrigger>
          <TabsTrigger value="policy">{t('leaveHistory.leavePolicy', 'Leave Policy')}</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  {t('leaveHistory.leaveRequestHistory', 'Leave Request History')}
                </CardTitle>
                <div className="flex gap-2">
                  <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('leaveHistory.allStatus', 'All Status')}</SelectItem>
                      <SelectItem value="pending">{t('leaveHistory.pending', 'Pending')}</SelectItem>
                      <SelectItem value="approved">{t('leaveHistory.approved', 'Approved')}</SelectItem>
                      <SelectItem value="rejected">{t('leaveHistory.rejected', 'Rejected')}</SelectItem>
                      <SelectItem value="cancelled">{t('leaveHistory.cancelled', 'Cancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {leaveRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>{t('leaveHistory.noRequestHistory', 'No leave request history')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaveRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(request.status)}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{getLeaveTypeLabel(request.leave_type)}</h4>
                            {getStatusBadge(request.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(parseDateFromDatabase(request.start_date), 'dd MMM yyyy', { locale: dateFnsLocale })} - {' '}
                            {format(parseDateFromDatabase(request.end_date), 'dd MMM yyyy', { locale: dateFnsLocale })}
                          </p>
                          <p className="text-sm text-muted-foreground">{request.reason}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{request.total_days} {t('leaveHistory.days', 'days')}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(request.created_at), 'dd MMM yyyy', { locale: dateFnsLocale })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                {t('leaveHistory.leaveAllocation', 'Leave Allocation')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaveAllocations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>{t('leaveHistory.noAllocation', 'No leave allocation')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaveAllocations.map((allocation) => {
                    const isExpired = allocation.expires_at && new Date(allocation.expires_at) < new Date();
                    
                    return (
                      <div
                        key={allocation.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          isExpired ? 'bg-destructive/5 border-destructive/20' : 'bg-background'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${
                            isExpired ? 'bg-destructive/10 text-destructive' : 'bg-muted'
                          }`}>
                            {getAllocationIcon(allocation.allocation_type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{getAllocationTypeLabel(allocation.allocation_type)}</h4>
                              {isExpired && (
                                <Badge variant="outline" className="text-destructive border-destructive">
                                  {t('leaveHistory.expired', 'Expired')}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium">{allocation.allocation_reason}</p>
                            {allocation.notes && (
                              <p className="text-sm text-muted-foreground">{allocation.notes}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                              <span>{t('leaveHistory.granted', 'Granted')}: {format(new Date(allocation.allocation_date), 'dd MMM yyyy', { locale: dateFnsLocale })}</span>
                              {allocation.expires_at && (
                                <span>
                                  {t('leaveHistory.expires', 'Expires')}: {format(new Date(allocation.expires_at), 'dd MMM yyyy', { locale: dateFnsLocale })}
                                </span>
                              )}
                            </div>
                            {allocation.allocation_type === 'annual_grant' && (
                              <div className="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded">
                                {t('leaveHistory.annualLeaveInfo', 'ℹ️ Annual leave is valid for the calendar year (Jan 1 - Dec 31). Remaining leave is not carried over to the next year.')}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-semibold ${
                            isExpired ? 'text-destructive' : 'text-foreground'
                          }`}>
                            +{allocation.days_allocated} {t('leaveHistory.days', 'days')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policy" className="space-y-4">
          {leavePolicy ? (
            <div className="space-y-8">
              {/* Strategy Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {t('leaveHistory.strategyTitle', 'Leave Grant Strategy')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3 p-4 border rounded-lg bg-muted/30">
                      {leavePolicy.leave_strategy === 'after_probation' ? (
                        <>
                          <Users className="h-5 w-5 text-primary mt-0.5" />
                          <div>
                            <div className="font-medium">{t('leaveHistory.afterProbation', 'Automatically after probation period ends')}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {t('leaveHistory.afterProbationDesc', 'Employees immediately receive full leave entitlement after probation period ends')}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <Clock className="h-5 w-5 text-primary mt-0.5" />
                          <div>
                            <div className="font-medium">{t('leaveHistory.afterWorkPeriod', 'After certain work period')}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {t('leaveHistory.afterWorkPeriodDesc', 'Employees receive leave entitlement after working for a specified period')}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {t('leaveHistory.configTitle', 'Policy Configuration')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {leavePolicy.leave_strategy === 'after_probation' ? (
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2 text-base font-medium">
                          <Users className="h-4 w-4" />
                          {t('leaveHistory.probationDuration', 'Probation Duration')}
                        </Label>
                        <div className="flex items-center gap-2">
                          <div className="text-2xl font-bold text-primary">{leavePolicy.probation_months}</div>
                          <span className="text-muted-foreground">{t('leaveHistory.months', 'months')}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t('leaveHistory.probationDesc', 'Probation period before employees receive leave entitlement')}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2 text-base font-medium">
                          <Clock className="h-4 w-4" />
                          {t('leaveHistory.leaveGrantAfter', 'Leave Granted After')}
                        </Label>
                        <div className="flex items-center gap-2">
                          <div className="text-2xl font-bold text-primary">{leavePolicy.leave_grant_after_months}</div>
                          <span className="text-muted-foreground">{t('leaveHistory.workMonths', 'work months')}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t('leaveHistory.leaveGrantDesc', 'Waiting period before employees receive leave entitlement')}
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <Label className="flex items-center gap-2 text-base font-medium">
                        <CalendarDays className="h-4 w-4" />
                        {t('leaveHistory.annualLeaveDays', 'Annual Leave Days')}
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold text-primary">{leavePolicy.annual_leave_days}</div>
                        <span className="text-muted-foreground">{t('leaveHistory.daysPerYear', 'days per year')}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t('leaveHistory.annualLeaveDesc', 'Total leave days granted each year')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Summary */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3 mb-4">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-blue-900">{t('leaveHistory.systemTitle', 'Annual Leave System')}</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        {t('leaveHistory.systemDesc', 'Summary of applied leave policy')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span className="font-medium">{t('leaveHistory.period', 'Period')}:</span>
                      <span>{t('leaveHistory.calendarYear', 'Calendar year (Jan 1 - Dec 31)')}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span className="font-medium">{t('leaveHistory.update', 'Update')}:</span>
                      <span>{t('leaveHistory.autoUpdate', 'Automatically every January 1st')}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span className="font-medium">{t('leaveHistory.remaining', 'Remaining leave')}:</span>
                      <span>{t('leaveHistory.expiresAtYearEnd', 'Expires on December 31st')}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span className="font-medium">{t('leaveHistory.carryOver', 'Carry Over')}:</span>
                      <span>{t('leaveHistory.noCarryOver', 'None (0 days)')}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span className="font-medium">{t('leaveHistory.newAllocation', 'New allocation')}:</span>
                      <span>{applyVariables(t('leaveHistory.daysPerYearAllocation', '{{days}} days each year'), { days: leavePolicy.annual_leave_days })}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-3">{t('leaveHistory.eligibilityPolicy', 'Eligibility Policy')}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-blue-600" />
                        <span dangerouslySetInnerHTML={{ __html: applyVariables(t('leaveHistory.employeeGetsDays', 'Employees receive <strong>{{days}} days</strong> leave per year'), { days: leavePolicy.annual_leave_days }) }} />
                      </div>
                      <div className="flex items-center gap-2">
                        {leavePolicy.leave_strategy === 'after_probation' ? (
                          <Users className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-blue-600" />
                        )}
                        <span>
                          {leavePolicy.leave_strategy === 'after_probation' 
                            ? applyVariables(t('leaveHistory.autoAfterProbation', 'Leave entitlement automatically after {{months}} months probation ends'), { months: leavePolicy.probation_months })
                            : applyVariables(t('leaveHistory.leaveAfterMonths', 'Leave entitlement starts after {{months}} work months'), { months: leavePolicy.leave_grant_after_months })
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('leaveHistory.policyNotSet', 'Leave Policy Not Set')}</h3>
                <p className="text-muted-foreground">
                  {t('leaveHistory.contactHR', 'Contact HR or administrator to set company leave policy.')}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

