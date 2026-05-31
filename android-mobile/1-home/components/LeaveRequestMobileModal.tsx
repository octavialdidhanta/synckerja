import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, User, Building, CalendarIcon, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card } from '@/mobile-app/components/ui/card';
import { DrawerSelectField } from '@/mobile-app/components/DrawerSelectField';
import { MobileDrawerDateField } from '@/mobile-app/components/MobileDrawerDateField';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';
import {
  ProfileDetailModalHeader,
  profileFullscreenDialogContentClass,
  profileFullscreenScrollBodyClass,
} from '@/mobile/1-profile/components/ProfileInfoModalParts';
import { LeaveEligibilityAlert } from '@/1-home/components/LeaveEligibilityAlert';
import { useLeaveRequestForm } from '@/shared/leave/useLeaveRequestForm';
import { todayIsoDateString, toIsoDateString } from '@/shared/leave/leaveRequestCalculations';
import { useEmployeeLeaveRequests } from '@/2-1-employees/MyInfo/LeavePermit/hooks/useEmployeeLeaveRequests';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { LeaveRequestHistoryList } from '@/mobile/1-home/components/LeaveRequestHistoryList';
import { MobileFormModalFooter } from '@/mobile-app/components/MobileFormModalFooter';

interface LeaveRequestMobileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LeaveRequestMobileModal = ({ open, onOpenChange }: LeaveRequestMobileModalProps) => {
  const [leaveTypeDrawerOpen, setLeaveTypeDrawerOpen] = useState(false);
  const { t, dateFnsLocale } = useAppTranslation();
  const isMobile = useIsMobile();
  const { data: currentEmployee } = useCurrentEmployee();
  const employeeId = currentEmployee?.id ?? '';

  const {
    data: leaveHistory = [],
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useEmployeeLeaveRequests({
    employeeId,
  });

  const {
    form,
    leaveTypes,
    employeeData,
    employeeLoading,
    eligibility,
    eligibilityLoading,
    requestedDays,
    remainingAfterRequest,
    isEligibleForRequest,
    handleSubmit,
    isSubmitting,
    resetForm,
  } = useLeaveRequestForm({
    onSuccess: () => {
      void refetchHistory();
    },
  });

  useEffect(() => {
    if (open && employeeId) {
      void refetchHistory();
    }
  }, [open, employeeId, refetchHistory]);

  useEffect(() => {
    if (!open) {
      resetForm();
      setLeaveTypeDrawerOpen(false);
    }
  }, [open, resetForm]);

  const handleClose = () => onOpenChange(false);
  const minDate = todayIsoDateString();
  const startDateValue = form.watch('startDate');
  const endMinDate = startDateValue ? toIsoDateString(startDateValue) : minDate;

  const submitLabel = isSubmitting
    ? t('leaveRequest.submitting', 'Submitting...')
    : eligibilityLoading
      ? t('common.loading', 'Loading...')
      : !eligibility?.isEligible
        ? t('leaveRequest.notEligible', 'Not Eligible for Leave')
        : remainingAfterRequest < 0
          ? t('leaveRequest.insufficientLeaveBalance', 'Insufficient Leave Balance')
          : t('leaveRequest.submit', 'Submit Leave Request');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={profileFullscreenDialogContentClass(isMobile)}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <ProfileDetailModalHeader
          isMobile={isMobile}
          title={t('leaveRequest.title', 'Employee Leave Request')}
          icon={CalendarDays}
          closeLabel={t('layout.sheetClose', 'Close')}
          onClose={handleClose}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          <div className={profileFullscreenScrollBodyClass()}>
            <div className="mx-auto w-full max-w-md space-y-4 pb-2">
            <LeaveEligibilityAlert />

            <Card className="border border-border bg-gradient-card">
              <div className="space-y-3 p-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {t('leaveRequest.employeeInfo', 'Employee Information')}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t('leaveRequest.employeeName', 'Employee Name')}</p>
                      <p className="text-sm font-medium text-foreground">
                        {employeeLoading
                          ? t('common.loading', 'Loading...')
                          : employeeData?.full_name || t('common.notAvailable', 'Not Available')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Building className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t('leaveRequest.department', 'Department')}</p>
                      <p className="text-sm font-medium text-foreground">
                        {employeeLoading
                          ? t('common.loading', 'Loading...')
                          : employeeData?.departments?.name || t('common.notAvailable', 'Not Available')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t('profile.joinDate', 'Join Date')}</p>
                      <p className="text-sm font-medium text-foreground">
                        {employeeLoading ? (
                          t('common.loading', 'Loading...')
                        ) : employeeData?.join_date || employeeData?.hire_date ? (
                          format(new Date(employeeData.join_date || employeeData.hire_date!), 'dd MMM yyyy', {
                            locale: dateFnsLocale,
                          })
                        ) : (
                          t('common.notAvailable', 'N/A')
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t('profile.remainingLeave', 'Remaining Leave')}</p>
                      <p className="text-sm font-medium text-foreground">
                        {eligibilityLoading ? (
                          t('common.loading', 'Loading...')
                        ) : eligibility ? (
                          applyVariables(t('profile.leaveBalance', '{{remaining}} days from {{total}} days/year'), {
                            remaining: String(eligibility.remainingDays),
                            total: String(eligibility.annualLeaveEntitlement),
                          })
                        ) : (
                          t('common.notAvailable', 'Not Available')
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Form {...form}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Card className="border border-border bg-gradient-card">
                  <div className="space-y-4 p-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      {t('leaveRequest.leaveDetails', 'Leave Request Details')}
                    </h3>

                    <FormField
                      control={form.control}
                      name="leaveType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t('leaveRequest.leaveTypeLabel', 'Leave Type')} <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <DrawerSelectField
                              open={leaveTypeDrawerOpen}
                              onOpenChange={setLeaveTypeDrawerOpen}
                              title={t('leaveRequest.leaveTypeLabel', 'Leave Type')}
                              value={field.value}
                              placeholder={t('leaveRequest.selectLeaveType', 'Select leave type')}
                              options={leaveTypes}
                              onSelect={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t('leaveRequest.startDate', 'Start Date')} <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <MobileDrawerDateField
                                title={t('leaveRequest.startDate', 'Start Date')}
                                value={field.value}
                                min={minDate}
                                containerOpen={open}
                                placeholder={t('datePicker.selectDate', 'Select date')}
                                onSelect={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t('leaveRequest.endDate', 'End Date')} <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <MobileDrawerDateField
                                title={t('leaveRequest.endDate', 'End Date')}
                                value={field.value}
                                min={endMinDate}
                                containerOpen={open}
                                placeholder={t('datePicker.selectDate', 'Select date')}
                                onSelect={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {requestedDays > 0 && (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-brand-blue/20 bg-brand-blue/5 p-3">
                          <p className="text-xs font-medium text-brand-blue">
                            {applyVariables(t('leaveRequest.totalLeaveDays', 'Total leave days: {{days}} days'), {
                              days: String(requestedDays),
                            })}
                          </p>
                        </div>
                        {eligibility && (
                          <div
                            className={cn(
                              'rounded-lg border p-3',
                              remainingAfterRequest >= 0
                                ? 'border-green-200 bg-green-50'
                                : 'border-red-200 bg-red-50',
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {remainingAfterRequest < 0 && (
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                              )}
                              <p
                                className={cn(
                                  'text-xs font-medium',
                                  remainingAfterRequest >= 0 ? 'text-green-700' : 'text-red-700',
                                )}
                              >
                                {remainingAfterRequest >= 0
                                  ? applyVariables(
                                      t(
                                        'leaveRequest.remainingAfterRequest',
                                        'Remaining leave after request: {{remaining}} days',
                                      ),
                                      { remaining: String(remainingAfterRequest) },
                                    )
                                  : applyVariables(
                                      t(
                                        'leaveRequest.insufficientLeave',
                                        'Insufficient leave: {{shortage}} days (You only have {{available}} days remaining)',
                                      ),
                                      {
                                        shortage: String(Math.abs(remainingAfterRequest)),
                                        available: String(eligibility.remainingDays),
                                      },
                                    )}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t('leaveRequest.reason', 'Leave Reason')} <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t('leaveRequest.reasonPlaceholder', 'Explain the reason for requesting leave...')}
                              className="min-h-[96px] resize-none"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            {applyVariables(
                              t('leaveRequest.minCharacters', 'Minimum {{min}} characters ({{current}}/{{min}})'),
                              { min: '10', current: String(field.value?.length || 0) },
                            )}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="emergencyContact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t('leaveRequest.emergencyContact', 'Emergency Contact')}{' '}
                            <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t(
                                'leaveRequest.emergencyContactPlaceholder',
                                'Name and phone number that can be contacted',
                              )}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="workHandover"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t('leaveRequest.workHandover', 'Work Handover')}{' '}
                            <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t(
                                'leaveRequest.workHandoverPlaceholder',
                                'Explain the work that will be handed over and to whom...',
                              )}
                              className="min-h-[96px] resize-none"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            {applyVariables(
                              t('leaveRequest.minCharacters', 'Minimum {{min}} characters ({{current}}/{{min}})'),
                              { min: '10', current: String(field.value?.length || 0) },
                            )}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </Card>
              </form>
            </Form>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                {t('leaveHistory.leaveRequestHistory', 'Leave Request History')}
              </h3>
              <LeaveRequestHistoryList requests={leaveHistory} loading={historyLoading && Boolean(employeeId)} />
            </div>
            </div>
          </div>

          <MobileFormModalFooter>
            <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !isEligibleForRequest || eligibilityLoading}
              className="flex min-w-[120px] items-center justify-center gap-1.5"
            >
              {isSubmitting || eligibilityLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {submitLabel}
            </Button>
          </MobileFormModalFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
