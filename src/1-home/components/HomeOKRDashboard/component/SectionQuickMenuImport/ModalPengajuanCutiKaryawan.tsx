import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { id, enUS } from 'date-fns/locale';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { CustomDatePicker } from '@/shared/calendar/CustomDatePicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { CalendarIcon, User, Building, Loader2, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useLeaveRequest } from '../../../../hooks/useLeaveRequest';
import { useEmployeeLeaveEligibility } from '../../../../hooks/useEmployeeLeaveEligibility';
import { LeaveEligibilityAlert } from '../../../../components/LeaveEligibilityAlert';

// Schema will be created inside component to access translation
const createLeaveRequestSchema = (t: (key: string, fallback: string) => string) => z.object({
  leaveType: z.string().min(1, t('leaveRequest.validation.leaveTypeRequired', 'Leave type must be selected')),
  startDate: z.date({
    required_error: t('leaveRequest.validation.startDateRequired', 'Start date must be filled')
  }),
  endDate: z.date({
    required_error: t('leaveRequest.validation.endDateRequired', 'End date must be filled')
  }),
  reason: z.string().min(10, t('leaveRequest.validation.reasonMinLength', 'Leave reason must be at least 10 characters')),
  emergencyContact: z.string().min(5, t('leaveRequest.validation.emergencyContactRequired', 'Emergency contact must be filled')),
  workHandover: z.string().min(10, t('leaveRequest.validation.workHandoverMinLength', 'Work handover must be at least 10 characters'))
}).refine(data => data.endDate >= data.startDate, {
  message: t('leaveRequest.validation.endDateBeforeStart', 'End date cannot be earlier than start date'),
  path: ['endDate']
});

type LeaveRequestFormData = z.infer<ReturnType<typeof createLeaveRequestSchema>>;

interface ModalPengajuanCutiKaryawanProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LeaveRequestFormData) => void;
}

export const ModalPengajuanCutiKaryawan: React.FC<ModalPengajuanCutiKaryawanProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const { t, dateFnsLocale } = useAppTranslation();
  const {
    data: employeeData,
    isLoading: employeeLoading
  } = useCurrentEmployee();
  const {
    createLeaveRequest,
    isLoading
  } = useLeaveRequest();
  const {
    data: eligibility,
    isLoading: eligibilityLoading
  } = useEmployeeLeaveEligibility();

  const leaveTypes = [{
    value: 'annual',
    label: t('leaveRequest.leaveType.annual', 'Annual Leave')
  }, {
    value: 'sick',
    label: t('leaveRequest.leaveType.sick', 'Sick Leave')
  }, {
    value: 'maternity',
    label: t('leaveRequest.leaveType.maternity', 'Maternity Leave')
  }, {
    value: 'paternity',
    label: t('leaveRequest.leaveType.paternity', 'Paternity Leave')
  }, {
    value: 'personal',
    label: t('leaveRequest.leaveType.personal', 'Personal Leave')
  }, {
    value: 'emergency',
    label: t('leaveRequest.leaveType.emergency', 'Emergency Leave')
  }, {
    value: 'unpaid',
    label: t('leaveRequest.leaveType.unpaid', 'Unpaid Leave')
  }];
  
  const leaveRequestSchema = createLeaveRequestSchema(t);
  
  const form = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      leaveType: '',
      reason: '',
      emergencyContact: '',
      workHandover: ''
    }
  });

  const handleSubmit = async (data: LeaveRequestFormData) => {
    console.log('Form submitted with data:', data);
    try {
      await createLeaveRequest(data);
      form.reset();
      onClose();
      onSubmit(data);
    } catch (error) {
      console.error('Error in form submission:', error);
    }
  };

  const calculateDays = () => {
    const startDate = form.watch('startDate');
    const endDate = form.watch('endDate');
    if (startDate && endDate) {
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return 0;
  };

  const requestedDays = calculateDays();
  const remainingAfterRequest = eligibility ? eligibility.remainingDays - requestedDays : 0;
  const isEligibleForRequest = eligibility?.isEligible && requestedDays > 0 && remainingAfterRequest >= 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[500px] h-[500px] max-h-[500px] overflow-y-auto p-0" style={{ zIndex: 50 }}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 z-20">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {t('leaveRequest.title', 'Employee Leave Request')}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              {t('leaveRequest.description', 'Submit a leave request by completing employee information, leave type, and desired period.')}
            </DialogDescription>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 px-6 pb-20">
            {/* Leave Eligibility Alert */}
            <LeaveEligibilityAlert />

            {/* Employee Info Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-900 mb-3">{t('leaveRequest.employeeInfo', 'Employee Information')}</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <User className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">{t('leaveRequest.employeeName', 'Employee Name')}</p>
                    <p className="text-sm font-medium text-gray-900">
                      {employeeLoading ? t('common.loading', 'Loading...') : (
                        employeeData?.full_name || t('common.notAvailable', 'Not Available')
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Building className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">{t('leaveRequest.department', 'Department')}</p>
                    <p className="text-sm font-medium text-gray-900">
                      {employeeLoading ? (
                        t('common.loading', 'Loading...')
                      ) : employeeData?.departments?.name ? (
                        employeeData.departments.name
                      ) : (
                        <span className="text-red-500 italic">{t('common.notAvailable', 'Not Available')}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex items-center space-x-3">
                  <CalendarIcon className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">{t('profile.joinDate', 'Join Date')}</p>
                    <p className="text-sm font-medium text-gray-900">
                      {employeeLoading ? (
                        t('common.loading', 'Loading...')
                      ) : employeeData?.join_date || employeeData?.hire_date ? (
                        format(new Date(employeeData.join_date || employeeData.hire_date), 'dd MMM yyyy', { locale: dateFnsLocale })
                      ) : (
                        <span className="text-orange-500">{t('common.notAvailable', 'N/A')}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">{t('profile.remainingLeave', 'Remaining Leave')}</p>
                    <p className="text-sm font-medium text-gray-900">
                      {eligibilityLoading ? (
                        t('common.loading', 'Loading...')
                      ) : eligibility ? (
                        <span className="text-orange-500">
                          {applyVariables(t('profile.leaveBalance', '{{remaining}} days from {{total}} days/year'), {
                            remaining: String(eligibility.remainingDays),
                            total: String(eligibility.annualLeaveEntitlement)
                          })}
                        </span>
                      ) : (
                        <span className="text-red-500 italic">{t('common.notAvailable', 'Not Available')}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Leave Details Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">{t('leaveRequest.leaveDetails', 'Leave Request Details')}</h3>
              
              {/* Department Display */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <span className="font-medium">
                    {t('leaveRequest.department', 'Department')}: {employeeLoading ? (
                      t('common.loading', 'Loading...')
                    ) : employeeData?.departments?.name ? (
                      employeeData.departments.name
                    ) : (
                      <span className="text-red-600">{t('leaveRequest.noDepartment', 'No department')}</span>
                    )}
                  </span>
                </p>
              </div>
              
              <FormField 
                control={form.control} 
                name="leaveType" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">{t('leaveRequest.leaveType', 'Leave Type')} <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('leaveRequest.selectLeaveType', 'Select leave type')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leaveTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} 
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField 
                  control={form.control} 
                  name="startDate" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">{t('leaveRequest.startDate', 'Start Date')} <span className="text-red-500">*</span></FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "dd MMMM yyyy", {
                                locale: dateFnsLocale
                              }) : <span>{t('datePicker.selectDate', 'Select date')}</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CustomDatePicker 
                            selected={field.value} 
                            onSelect={field.onChange} 
                            disabled={date => date < new Date()} 
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )} 
                />

                <FormField 
                  control={form.control} 
                  name="endDate" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">{t('leaveRequest.endDate', 'End Date')} <span className="text-red-500">*</span></FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "dd MMMM yyyy", {
                                locale: dateFnsLocale
                              }) : <span>{t('datePicker.selectDate', 'Select date')}</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CustomDatePicker 
                            selected={field.value} 
                            onSelect={field.onChange} 
                            disabled={date => {
                              const startDate = form.getValues('startDate');
                              return date < new Date() || (startDate && date < startDate);
                            }} 
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )} 
                />
              </div>

              {requestedDays > 0 && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-700">
                      <span className="font-medium">{applyVariables(t('leaveRequest.totalLeaveDays', 'Total leave days: {{days}} days'), { days: String(requestedDays) })}</span>
                    </p>
                  </div>
                  
                  {eligibility && (
                    <div className={cn("rounded-lg p-3 border", remainingAfterRequest >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
                      <div className="flex items-center gap-2">
                        {remainingAfterRequest < 0 && <AlertTriangle className="h-4 w-4 text-red-600" />}
                        <p className={cn("text-xs font-medium", remainingAfterRequest >= 0 ? "text-green-700" : "text-red-700")}>
                          {remainingAfterRequest >= 0 
                            ? applyVariables(t('leaveRequest.remainingAfterRequest', 'Remaining leave after request: {{remaining}} days'), { remaining: String(remainingAfterRequest) })
                            : applyVariables(t('leaveRequest.insufficientLeave', 'Insufficient leave: {{shortage}} days (You only have {{available}} days remaining)'), { 
                                shortage: String(Math.abs(remainingAfterRequest)), 
                                available: String(eligibility.remainingDays) 
                              })
                          }
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
                    <FormLabel className="text-sm font-semibold">{t('leaveRequest.reason', 'Leave Reason')} <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={t('leaveRequest.reasonPlaceholder', 'Explain the reason for requesting leave...')} 
                        className="min-h-[100px] resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <p className="text-xs text-gray-500">
                      {applyVariables(t('leaveRequest.minCharacters', 'Minimum {{min}} characters ({{current}}/{{min}})'), { 
                        min: '10', 
                        current: String(field.value?.length || 0) 
                      })}
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
                    <FormLabel className="text-sm font-semibold">{t('leaveRequest.emergencyContact', 'Emergency Contact')} <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder={t('leaveRequest.emergencyContactPlaceholder', 'Name and phone number that can be contacted')} {...field} />
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
                    <FormLabel className="text-sm font-semibold">{t('leaveRequest.workHandover', 'Work Handover')} <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={t('leaveRequest.workHandoverPlaceholder', 'Explain the work that will be handed over and to whom...')} 
                        className="min-h-[100px] resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <p className="text-xs text-gray-500">
                      {applyVariables(t('leaveRequest.minCharacters', 'Minimum {{min}} characters ({{current}}/{{min}})'), { 
                        min: '10', 
                        current: String(field.value?.length || 0) 
                      })}
                    </p>
                    <FormMessage />
                  </FormItem>
                )} 
              />
            </div>
          </form>
        </Form>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex justify-between gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 text-sm" disabled={isLoading}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button 
              type="submit" 
              onClick={form.handleSubmit(handleSubmit)} 
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm" 
              disabled={isLoading || !isEligibleForRequest || eligibilityLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('leaveRequest.submitting', 'Submitting...')}
                </>
              ) : eligibilityLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('common.loading', 'Loading...')}
                </>
              ) : !eligibility?.isEligible ? (
                t('leaveRequest.notEligible', 'Not Eligible for Leave')
              ) : remainingAfterRequest < 0 ? (
                t('leaveRequest.insufficientLeaveBalance', 'Insufficient Leave Balance')
              ) : (
                t('leaveRequest.submit', 'Submit Leave Request')
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

