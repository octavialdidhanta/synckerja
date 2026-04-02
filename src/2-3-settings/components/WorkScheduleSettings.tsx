
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Badge } from '@/shared/components/ui/badge';
import { Calendar, Clock, Plus, Settings, Trash2, Users, AlertCircle } from 'lucide-react';
import { useWorkScheduleSettings, WorkScheduleSettings as WorkScheduleSettingsType } from '@/2-1-employees/MyInfo/Attendance/hooks/useWorkScheduleSettings';
import { useAttendanceHolidays } from '@/features/2-3-settings/hooks/useLocationManagement';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { useEffect } from 'react';
import { ManualHolidayForm } from './ManualHolidayForm';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useReportAttendanceSettingsLoading } from '@/2-3-attendance/context/AttendancePageLoadContext';
import { applyVariables } from '@/shared/i18n/translations';
import { format } from 'date-fns';
import { id, enUS } from 'date-fns/locale';

const getDaysOfWeek = (t: any) => [
  { value: 1, label: t('workSchedule.days.monday', 'Monday') },
  { value: 2, label: t('workSchedule.days.tuesday', 'Tuesday') },
  { value: 3, label: t('workSchedule.days.wednesday', 'Wednesday') },
  { value: 4, label: t('workSchedule.days.thursday', 'Thursday') },
  { value: 5, label: t('workSchedule.days.friday', 'Friday') },
  { value: 6, label: t('workSchedule.days.saturday', 'Saturday') },
  { value: 7, label: t('workSchedule.days.sunday', 'Sunday') },
];

const getSchedulePresets = (t: any) => [
  { name: t('workSchedule.presets.mondayFriday', 'Monday - Friday'), working_days: [1, 2, 3, 4, 5] },
  { name: t('workSchedule.presets.mondaySaturday', 'Monday - Saturday'), working_days: [1, 2, 3, 4, 5, 6] },
  { name: t('workSchedule.presets.everyDay', 'Every Day'), working_days: [1, 2, 3, 4, 5, 6, 7] },
];

export const WorkScheduleSettings = () => {
  const { t, language } = useAppTranslation();
  const dateLocale = language === 'id' ? id : enUS;
  const { settings, loading, createSettings, updateSettings, deleteSettings } = useWorkScheduleSettings();
  const {
    holidays,
    toggleHolidayStatus,
    workingDaysSummary,
    fetchWorkingDaysSummary,
    deleteHoliday,
    loading: holidaysLoading,
  } = useAttendanceHolidays();
  const settingsPanelLoading = loading || holidaysLoading;
  useReportAttendanceSettingsLoading(settingsPanelLoading);
  const { organizationId } = useCurrentOrg();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkScheduleSettingsType | null>(null);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  
  const DAYS_OF_WEEK = getDaysOfWeek(t);
  const SCHEDULE_PRESETS = getSchedulePresets(t);

  const [formData, setFormData] = useState({
    name: '',
    working_days: [1, 2, 3, 4, 5],
    start_time: '08:00',
    end_time: '17:00',
    break_start_time: '12:00',
    break_end_time: '13:00',
    late_tolerance_minutes: 15,
    overtime_threshold_minutes: 0,
    is_default: false,
    timezone: 'Asia/Jakarta',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingSchedule) {
      const result = await updateSettings(editingSchedule.id, formData);
      if (result) {
        setEditingSchedule(null);
        resetForm();
        // Refresh working days summary when schedule is updated
        if (organizationId) {
          fetchWorkingDaysSummary();
        }
      }
    } else {
      const result = await createSettings({
        ...formData,
        organization_id: organizationId!,
        is_active: true,
      });
      if (result) {
        setShowCreateForm(false);
        resetForm();
        // Refresh working days summary when new schedule is created
        if (organizationId) {
          fetchWorkingDaysSummary();
        }
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      working_days: [1, 2, 3, 4, 5],
      start_time: '08:00',
      end_time: '17:00',
      break_start_time: '12:00',
      break_end_time: '13:00',
      late_tolerance_minutes: 15,
      overtime_threshold_minutes: 0,
      is_default: false,
      timezone: 'Asia/Jakarta',
    });
  };

  const handleEdit = (schedule: WorkScheduleSettingsType) => {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      working_days: schedule.working_days,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      break_start_time: schedule.break_start_time || '12:00',
      break_end_time: schedule.break_end_time || '13:00',
      late_tolerance_minutes: schedule.late_tolerance_minutes,
      overtime_threshold_minutes: schedule.overtime_threshold_minutes,
      is_default: schedule.is_default,
      timezone: schedule.timezone,
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (scheduleId: string) => {
    const result = await deleteSettings(scheduleId);
    if (result && organizationId) {
      // Refresh working days summary when schedule is deleted
      fetchWorkingDaysSummary();
    }
  };

  // Load working days summary on component mount
  useEffect(() => {
    if (organizationId) {
      fetchWorkingDaysSummary();
    }
  }, [organizationId, fetchWorkingDaysSummary]);

  const formatWorkingDays = (days: number[]) => {
    return days.map(day => DAYS_OF_WEEK.find(d => d.value === day)?.label).join(', ');
  };

  if (settingsPanelLoading) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-2xl font-semibold">{t('workSchedule.title', 'Work Schedule Settings')}</h2>
          <p className="text-muted-foreground mt-1">{t('workSchedule.description', 'Manage working days, working hours, and national holidays')}</p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('workSchedule.button.addSchedule', 'Add Schedule')}
        </Button>
      </div>

      <Tabs defaultValue="schedules" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="schedules">
            <Clock className="h-4 w-4 mr-2" />
            {t('workSchedule.tab.workSchedule', 'Work Schedule')}
          </TabsTrigger>
          <TabsTrigger value="holidays">
            <Calendar className="h-4 w-4 mr-2" />
            {t('workSchedule.tab.nationalHolidays', 'National Holidays')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="space-y-4">
          {showCreateForm && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {editingSchedule ? t('workSchedule.form.editTitle', 'Edit Work Schedule') : t('workSchedule.form.addTitle', 'Add New Work Schedule')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="name">{t('workSchedule.form.scheduleName', 'Schedule Name')}</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder={t('workSchedule.form.scheduleNamePlaceholder', 'e.g., Regular Schedule')}
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>{t('workSchedule.form.workingDays', 'Working Days')}</Label>
                      <div className="mt-2 space-y-2">
                        <div className="flex gap-2 mb-3">
                          {SCHEDULE_PRESETS.map((preset) => (
                            <Badge
                              key={preset.name}
                              variant="outline"
                              className="hover:bg-muted/50 cursor-pointer"
                              onClick={() => setFormData(prev => ({ ...prev, working_days: preset.working_days }))}
                            >
                              {preset.name}
                            </Badge>
                          ))}
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {DAYS_OF_WEEK.map((day) => (
                            <div key={day.value} className="flex items-center space-x-2">
                              <Switch
                                checked={formData.working_days.includes(day.value)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData(prev => ({ 
                                      ...prev, 
                                      working_days: [...prev.working_days, day.value].sort() 
                                    }));
                                  } else {
                                    setFormData(prev => ({ 
                                      ...prev, 
                                      working_days: prev.working_days.filter(d => d !== day.value) 
                                    }));
                                  }
                                }}
                              />
                              <Label className="text-sm">{day.label}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="start_time">{t('workSchedule.form.startTime', 'Start Time')}</Label>
                      <Input
                        id="start_time"
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="end_time">{t('workSchedule.form.endTime', 'End Time')}</Label>
                      <Input
                        id="end_time"
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="break_start_time">{t('workSchedule.form.breakStartTime', 'Break Start Time')}</Label>
                      <Input
                        id="break_start_time"
                        type="time"
                        value={formData.break_start_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, break_start_time: e.target.value }))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="break_end_time">{t('workSchedule.form.breakEndTime', 'Break End Time')}</Label>
                      <Input
                        id="break_end_time"
                        type="time"
                        value={formData.break_end_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, break_end_time: e.target.value }))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="late_tolerance">{t('workSchedule.form.lateTolerance', 'Late Tolerance (minutes)')}</Label>
                      <Input
                        id="late_tolerance"
                        type="number"
                        min="0"
                        max="60"
                        value={formData.late_tolerance_minutes}
                        onChange={(e) => setFormData(prev => ({ ...prev, late_tolerance_minutes: parseInt(e.target.value) || 0 }))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="timezone">{t('workSchedule.form.timezone', 'Timezone')}</Label>
                      <Select value={formData.timezone} onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Asia/Jakarta">Asia/Jakarta (WIB)</SelectItem>
                          <SelectItem value="Asia/Makassar">Asia/Makassar (WITA)</SelectItem>
                          <SelectItem value="Asia/Jayapura">Asia/Jayapura (WIT)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2 flex items-center space-x-2">
                      <Switch
                        checked={formData.is_default}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_default: checked }))}
                      />
                      <Label>{t('workSchedule.form.setAsDefault', 'Set as default schedule')}</Label>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCreateForm(false);
                        setEditingSchedule(null);
                        resetForm();
                      }}
                    >
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button type="submit">
                      {editingSchedule ? t('workSchedule.form.updateSchedule', 'Update Schedule') : t('workSchedule.form.saveSchedule', 'Save Schedule')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {settings.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('workSchedule.emptyState', 'No work schedules configured yet. Add the first work schedule to set employee working days and hours.')}
                </AlertDescription>
              </Alert>
            ) : (
              settings.map((schedule) => (
                <Card key={schedule.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{schedule.name}</h3>
                          {schedule.is_default && (
                            <Badge variant="secondary">{t('workSchedule.badge.default', 'Default')}</Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground space-y-1 text-sm">
                          <p><strong>{t('workSchedule.card.workingDays', 'Working Days')}:</strong> {formatWorkingDays(schedule.working_days)}</p>
                          <p><strong>{t('workSchedule.card.workingHours', 'Working Hours')}:</strong> {schedule.start_time} - {schedule.end_time}</p>
                          <p><strong>{t('workSchedule.card.breakTime', 'Break Time')}:</strong> {schedule.break_start_time} - {schedule.break_end_time}</p>
                          <p><strong>{t('workSchedule.card.lateTolerance', 'Late Tolerance')}:</strong> {applyVariables(t('workSchedule.card.lateToleranceMinutes', '{{minutes}} minutes'), { minutes: String(schedule.late_tolerance_minutes) })}</p>
                          <p><strong>{t('workSchedule.card.timezone', 'Timezone')}:</strong> {schedule.timezone}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(schedule)}
                        >
                          {t('common.edit', 'Edit')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(schedule.id)}
                          className="text-destructive hover:text-destructive/90"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="holidays" className="space-y-4">
          <div className="flex items-center justify-between">
            <Alert className="flex-1 mr-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('workSchedule.holidays.alert', 'Activated national holidays will affect the attendance system. Employees will not be required to attend on these days.')}
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => setShowHolidayForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('workSchedule.holidays.addHoliday', 'Add Holiday')}
            </Button>
          </div>

          {/* Working Days Summary */}
          {workingDaysSummary && (
            <Card className="border-primary/25 bg-accent">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="text-primary h-5 w-5" />
                  <div>
                    <h3 className="text-foreground font-semibold">{t('workSchedule.holidays.workingDaysThisMonth', 'Working Days This Month')}</h3>
                    <p className="text-sm text-primary">
                      {applyVariables(t('workSchedule.holidays.summary', 'Total: {{workingDays}} working days • {{holidayDays}} holidays • {{weekendDays}} weekends'), {
                        workingDays: String(workingDaysSummary.summary.working_days),
                        holidayDays: String(workingDaysSummary.summary.holiday_days),
                        weekendDays: String(workingDaysSummary.summary.weekend_days)
                      })}
                    </p>
                    <p className="mt-1 text-xs text-primary/90">
                      {t('workSchedule.holidays.calculatedAt', 'Calculated automatically')}: {format(new Date(workingDaysSummary.calculated_at), 'PPpp', { locale: dateLocale })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual Holiday Form */}
          {showHolidayForm && (
            <ManualHolidayForm 
              onSuccess={() => {
                setShowHolidayForm(false);
                if (organizationId) {
                  fetchWorkingDaysSummary();
                }
              }}
              onCancel={() => setShowHolidayForm(false)}
            />
          )}

          {/* Organization Holidays Section */}
          {holidays.filter(h => h.organization_id).length > 0 && (
            <div className="space-y-2">
              <h3 className="text-foreground flex items-center gap-2 text-lg font-semibold">
                <Users className="h-5 w-5" />
                {t('workSchedule.holidays.organizationHolidays', 'Organization Holidays')}
              </h3>
              <div className="grid gap-4">
                {holidays.filter(h => h.organization_id).map((holiday) => (
                  <Card
                    key={holiday.id}
                    className={`border-l-4 border-l-primary ${!holiday.is_active ? 'bg-muted/50 opacity-60' : 'bg-accent'}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-semibold ${!holiday.is_active ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {holiday.name}
                            </h3>
                            {!holiday.is_active && (
                              <Badge variant="secondary" className="text-xs">
                                {t('workSchedule.holidays.inactive', 'Inactive')}
                              </Badge>
                            )}
                            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-xs text-primary">
                              {t('workSchedule.holidays.organization', 'Organization')}
                            </Badge>
                          </div>
                          <p className={`text-sm ${!holiday.is_active ? 'text-muted-foreground/70' : 'text-primary'}`}>
                            {(() => {
                              try {
                                const date = new Date(holiday.date);
                                return isNaN(date.getTime()) ? holiday.date : format(date, 'EEEE, d MMMM yyyy', { locale: dateLocale });
                              } catch {
                                return holiday.date;
                              }
                            })()}
                          </p>
                          <div className="text-muted-foreground flex items-center gap-2 text-xs">
                            <span>{t('workSchedule.holidays.country', 'Country')}: {holiday.country_code}</span>
                            <span>• {t('workSchedule.holidays.orgId', 'Org ID')}: {holiday.organization_id}</span>
                          </div>
                          {holiday.is_recurring && (
                            <Badge variant="outline" className="text-xs">
                              {applyVariables(t('workSchedule.holidays.recurringAnnual', 'Recurring Annual ({{type}})'), { type: holiday.recurring_type || 'annual' })}
                            </Badge>
                          )}
                          {holiday.is_active && holiday.applies_to_attendance && (
                            <Badge variant="secondary" className="bg-success-muted text-xs text-success-foreground">
                              {t('workSchedule.holidays.appliesToAttendance', 'Applies to Attendance')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (window.confirm(t('workSchedule.holidays.confirmDelete', 'Are you sure you want to delete this holiday?'))) {
                                deleteHoliday(holiday.id);
                              }
                            }}
                            className="text-destructive hover:text-destructive/90"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Label className="text-sm">{t('workSchedule.holidays.enableHoliday', 'Enable holiday')}</Label>
                          <Switch
                            checked={holiday.is_active}
                            onCheckedChange={() => toggleHolidayStatus(holiday.id, holiday.is_active)}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* National Holidays Section */}
          <div className="space-y-2">
            <h3 className="text-foreground flex items-center gap-2 text-lg font-semibold">
              <Calendar className="h-5 w-5" />
              {t('workSchedule.holidays.nationalHolidays', 'National Holidays')}
            </h3>
            <div className="grid gap-4">
              {holidays.filter(h => !h.organization_id).map((holiday) => (
                <Card key={holiday.id} className={!holiday.is_active ? 'bg-muted/50 opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className={`font-semibold ${!holiday.is_active ? 'text-muted-foreground' : ''}`}>
                            {holiday.name}
                          </h3>
                          {!holiday.is_active && (
                            <Badge variant="secondary" className="text-xs">
                              {t('workSchedule.holidays.inactive', 'Inactive')}
                            </Badge>
                          )}
                        </div>
                        <p className={`text-sm ${!holiday.is_active ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                          {(() => {
                            try {
                              const date = new Date(holiday.date);
                              return isNaN(date.getTime()) ? holiday.date : format(date, 'EEEE, d MMMM yyyy', { locale: dateLocale });
                            } catch {
                              return holiday.date;
                            }
                          })()}
                        </p>
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <span>{t('workSchedule.holidays.country', 'Country')}: {holiday.country_code}</span>
                        </div>
                        {holiday.is_recurring && (
                          <Badge variant="outline" className="text-xs">
                            {applyVariables(t('workSchedule.holidays.recurringAnnual', 'Recurring Annual ({{type}})'), { type: holiday.recurring_type || 'annual' })}
                          </Badge>
                        )}
                        {holiday.is_active && holiday.applies_to_attendance && (
                          <Badge variant="secondary" className="bg-success-muted text-xs text-success-foreground">
                            {t('workSchedule.holidays.appliesToAttendance', 'Applies to Attendance')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label className="text-sm">{t('workSchedule.holidays.enableHoliday', 'Enable holiday')}</Label>
                        <Switch
                          checked={holiday.is_active}
                          onCheckedChange={() => toggleHolidayStatus(holiday.id, holiday.is_active)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
