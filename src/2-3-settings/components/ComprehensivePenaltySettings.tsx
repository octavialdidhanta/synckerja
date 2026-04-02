import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { Badge } from '@/shared/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import { Calendar } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { 
  Settings, 
  DollarSign, 
  Users, 
  Shield, 
  AlertTriangle, 
  Plus,
  Pencil,
  Trash2,
  CalendarIcon,
  Clock,
  Bell,
  Target
} from 'lucide-react';
import { usePenaltySettings, usePenaltyRules } from '@/features/2-3-settings/hooks/useLocationManagement';
import { useEmployees } from '@/2-1-employees/hooks/useEmployees';
import { PenaltyRuleFormDialog } from '../modals/PenaltyRuleFormDialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useReportAttendanceSettingsLoading } from '@/2-3-attendance/context/AttendancePageLoadContext';
import { applyVariables } from '@/shared/i18n/translations';
import { id, enUS } from 'date-fns/locale';

export const ComprehensivePenaltySettings = () => {
  const { t, language } = useAppTranslation();
  const dateLocale = language === 'id' ? id : enUS;
  const {
    settings,
    queriesLoading,
    updateSettings,
    exemptions,
    createExemption,
    updateExemption,
    deleteExemption,
  } = usePenaltySettings();
  const { rules = [], deleteRule, loading: rulesLoading } = usePenaltyRules();
  const { data: employees = [], isPending: employeesPending } = useEmployees();
  const settingsPanelLoading = queriesLoading || rulesLoading || employeesPending;
  useReportAttendanceSettingsLoading(settingsPanelLoading);
  const [activeTab, setActiveTab] = useState('general');
  const [isExemptionDialogOpen, setIsExemptionDialogOpen] = useState(false);
  const [editingExemption, setEditingExemption] = useState<any>(null);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);

  // Form states
  const [generalSettings, setGeneralSettings] = useState({
    enable_automatic_penalties: settings?.enable_automatic_penalties ?? true,
    penalty_calculation_timezone: settings?.penalty_calculation_timezone ?? 'Asia/Jakarta',
    minimum_penalty_amount: settings?.minimum_penalty_amount ?? 0,
    maximum_daily_penalty: settings?.maximum_daily_penalty ?? 0,
    maximum_monthly_penalty: settings?.maximum_monthly_penalty ?? 0,
    penalty_deduction_date: settings?.penalty_deduction_date ?? 25,
    default_calculation_type: settings?.default_calculation_type ?? 'fixed',
    default_hourly_rate: settings?.default_hourly_rate ?? 50000,
    default_salary_percentage: settings?.default_salary_percentage ?? 5.0,
    enable_salary_based_calculation: settings?.enable_salary_based_calculation ?? true,
  });

  const [notificationSettings, setNotificationSettings] = useState({
    notify_employee: settings?.notification_settings?.notify_employee ?? true,
    notify_manager: settings?.notification_settings?.notify_manager ?? true,
    notify_hr: settings?.notification_settings?.notify_hr ?? true,
  });

  const [holidaySettings, setHolidaySettings] = useState({
    apply_on_holidays: settings?.holiday_penalty_rules?.apply_on_holidays ?? false,
    apply_on_weekends: settings?.holiday_penalty_rules?.apply_on_weekends ?? false,
  });

  const [graceSettings, setGraceSettings] = useState({
    first_offense_grace: settings?.grace_settings?.first_offense_grace ?? false,
    monthly_grace_limit: settings?.grace_settings?.monthly_grace_limit ?? 0,
  });

  const [exemptionForm, setExemptionForm] = useState({
    employee_id: '',
    penalty_rule_id: '',
    exemption_type: 'temporary',
    start_date: new Date(),
    end_date: undefined as Date | undefined,
    reason: '',
    conditions: '',
  });

  useEffect(() => {
    if (!settings) {
      setGeneralSettings({
        enable_automatic_penalties: true,
        penalty_calculation_timezone: 'Asia/Jakarta',
        minimum_penalty_amount: 0,
        maximum_daily_penalty: 0,
        maximum_monthly_penalty: 0,
        penalty_deduction_date: 25,
        default_calculation_type: 'fixed',
        default_hourly_rate: 50000,
        default_salary_percentage: 5,
        enable_salary_based_calculation: true,
      });
      setNotificationSettings({
        notify_employee: true,
        notify_manager: true,
        notify_hr: true,
      });
      setHolidaySettings({
        apply_on_holidays: false,
        apply_on_weekends: false,
      });
      setGraceSettings({
        first_offense_grace: false,
        monthly_grace_limit: 0,
      });
      return;
    }

    setGeneralSettings({
      enable_automatic_penalties: settings.enable_automatic_penalties ?? true,
      penalty_calculation_timezone: settings.penalty_calculation_timezone ?? 'Asia/Jakarta',
      minimum_penalty_amount: Number(settings.minimum_penalty_amount ?? 0),
      maximum_daily_penalty: Number(settings.maximum_daily_penalty ?? 0),
      maximum_monthly_penalty: Number(settings.maximum_monthly_penalty ?? 0),
      penalty_deduction_date: settings.penalty_deduction_date ?? 25,
      default_calculation_type: settings.default_calculation_type ?? 'fixed',
      default_hourly_rate: Number(settings.default_hourly_rate ?? 50000),
      default_salary_percentage: Number(settings.default_salary_percentage ?? 5),
      enable_salary_based_calculation: settings.enable_salary_based_calculation ?? true,
    });

    const notification = settings.notification_settings ?? {};
    setNotificationSettings({
      notify_employee: notification.notify_employee ?? true,
      notify_manager: notification.notify_manager ?? true,
      notify_hr: notification.notify_hr ?? true,
    });

    const holiday = settings.holiday_penalty_rules ?? {};
    setHolidaySettings({
      apply_on_holidays: holiday.apply_on_holidays ?? false,
      apply_on_weekends: holiday.apply_on_weekends ?? false,
    });

    const grace = settings.grace_settings ?? {};
    setGraceSettings({
      first_offense_grace: grace.first_offense_grace ?? false,
      monthly_grace_limit: grace.monthly_grace_limit ?? 0,
    });
  }, [settings]);

  const handleSaveGeneralSettings = async () => {
    try {
      await updateSettings({
        ...generalSettings,
        notification_settings: notificationSettings,
        holiday_penalty_rules: holidaySettings,
        grace_settings: graceSettings,
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleCreateExemption = async () => {
    try {
      await createExemption({
        ...exemptionForm,
        start_date: exemptionForm.start_date.toISOString().split('T')[0],
        end_date: exemptionForm.end_date?.toISOString().split('T')[0],
        conditions: exemptionForm.conditions ? JSON.parse(exemptionForm.conditions) : null,
        is_active: true,
      });
      setIsExemptionDialogOpen(false);
      resetExemptionForm();
    } catch (error) {
      console.error('Error creating exemption:', error);
    }
  };

  const resetExemptionForm = () => {
    setExemptionForm({
      employee_id: '',
      penalty_rule_id: '',
      exemption_type: 'temporary',
      start_date: new Date(),
      end_date: undefined,
      reason: '',
      conditions: '',
    });
    setEditingExemption(null);
  };

  const handleEditRule = (rule: any) => {
    setEditingRule(rule);
    setIsRuleDialogOpen(true);
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (confirm(t('penaltySettings.confirmDeleteRule', 'Are you sure you want to delete this penalty rule?'))) {
      await deleteRule(ruleId);
    }
  };

  const handleRuleDialogClose = () => {
    setIsRuleDialogOpen(false);
    setEditingRule(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (settingsPanelLoading) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-2xl font-semibold">{t('penaltySettings.title', 'Late Penalty Settings')}</h2>
          <p className="text-muted-foreground mt-1">{t('penaltySettings.description', 'Manage rules and penalty settings for attendance violations')}</p>
        </div>
        <Badge variant={generalSettings.enable_automatic_penalties ? "default" : "secondary"}>
          {generalSettings.enable_automatic_penalties ? t('penaltySettings.status.active', 'Active') : t('penaltySettings.status.inactive', 'Inactive')}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t('penaltySettings.tab.general', 'General')}
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            {t('penaltySettings.tab.rules', 'Rules')}
          </TabsTrigger>
          <TabsTrigger value="exemptions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('penaltySettings.tab.exemptions', 'Exemptions')}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t('penaltySettings.tab.notifications', 'Notifications')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {/* Info Section about Calculation Types */}
          <Card className="border-primary/25 bg-accent">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Target className="h-5 w-5" />
                {t('penaltySettings.calculationTypes.title', 'Penalty Calculation Types')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <h4 className="text-primary mb-2 font-semibold">{t('penaltySettings.calculationTypes.fixed.title', '1. Fixed Penalty')}</h4>
                  <p className="text-muted-foreground mb-2">
                    {t('penaltySettings.calculationTypes.fixed.description', 'Fixed penalty that does not change based on late duration.')}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    {t('penaltySettings.calculationTypes.fixed.example', 'Example: Late 5 minutes or 60 minutes, fixed penalty Rp 500,000')}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <h4 className="text-success mb-2 font-semibold">{t('penaltySettings.calculationTypes.hourly.title', '2. Per Hour')}</h4>
                  <p className="text-muted-foreground mb-2">
                    {t('penaltySettings.calculationTypes.hourly.description', 'Penalty calculated based on late duration × hourly rate.')}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    {t('penaltySettings.calculationTypes.hourly.example', 'Example: Late 2 hours × Rp 50,000/hour = Rp 100,000')}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <h4 className="text-info mb-2 font-semibold">{t('penaltySettings.calculationTypes.salaryPercentage.title', '3. Salary Percentage')}</h4>
                  <p className="text-muted-foreground mb-2">
                    {t('penaltySettings.calculationTypes.salaryPercentage.description', 'Penalty based on percentage of employee monthly salary.')}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    {t('penaltySettings.calculationTypes.salaryPercentage.example', 'Example: 5% of salary Rp 10,000,000 = Rp 500,000')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t('penaltySettings.basicSettings.title', 'Basic Settings')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={generalSettings.enable_automatic_penalties}
                    onCheckedChange={(checked) => 
                      setGeneralSettings(prev => ({ ...prev, enable_automatic_penalties: checked }))
                    }
                  />
                  <Label>{t('penaltySettings.basicSettings.enableAutomaticPenalties', 'Enable automatic penalties')}</Label>
                </div>

                <div>
                  <Label>{t('penaltySettings.basicSettings.calculationTimezone', 'Calculation Timezone')}</Label>
                  <Select 
                    value={generalSettings.penalty_calculation_timezone}
                    onValueChange={(value) => 
                      setGeneralSettings(prev => ({ ...prev, penalty_calculation_timezone: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Jakarta">{t('penaltySettings.timezone.wib', 'WIB (Asia/Jakarta)')}</SelectItem>
                      <SelectItem value="Asia/Makassar">{t('penaltySettings.timezone.wita', 'WITA (Asia/Makassar)')}</SelectItem>
                      <SelectItem value="Asia/Jayapura">{t('penaltySettings.timezone.wit', 'WIT (Asia/Jayapura)')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t('penaltySettings.basicSettings.salaryDeductionDate', 'Salary Deduction Date')}</Label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    value={generalSettings.penalty_deduction_date}
                    onChange={(e) => 
                      setGeneralSettings(prev => ({ ...prev, penalty_deduction_date: parseInt(e.target.value) || 25 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('penaltySettings.basicSettings.salaryDeductionDateDescription', 'Date in the month when penalty is deducted from salary')}
                  </p>
                </div>

                <div>
                  <Label>{t('penaltySettings.basicSettings.defaultCalculationType', 'Default Penalty Calculation Type')}</Label>
                  <Select 
                    value={generalSettings.default_calculation_type}
                    onValueChange={(value) => 
                      setGeneralSettings(prev => ({ ...prev, default_calculation_type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">{t('penaltySettings.calculationTypes.fixed.title', 'Fixed Penalty')}</SelectItem>
                      <SelectItem value="hourly">{t('penaltySettings.calculationTypes.hourly.title', 'Per Hour')}</SelectItem>
                      <SelectItem value="salary_percentage">{t('penaltySettings.calculationTypes.salaryPercentage.title', 'Salary Percentage')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('penaltySettings.basicSettings.defaultCalculationTypeDescription', 'Penalty calculation type used by default')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  {t('penaltySettings.penaltyLimits.title', 'Penalty Limits')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t('penaltySettings.penaltyLimits.minimumPenalty', 'Minimum Penalty (Rp)')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={generalSettings.minimum_penalty_amount}
                    onChange={(e) => 
                      setGeneralSettings(prev => ({ ...prev, minimum_penalty_amount: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>

                <div>
                  <Label>{t('penaltySettings.penaltyLimits.maximumDailyPenalty', 'Maximum Daily Penalty (Rp)')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={generalSettings.maximum_daily_penalty || ''}
                    onChange={(e) => 
                      setGeneralSettings(prev => ({ ...prev, maximum_daily_penalty: parseFloat(e.target.value) || 0 }))
                    }
                    placeholder={t('penaltySettings.penaltyLimits.unlimited', 'Unlimited')}
                  />
                </div>

                <div>
                  <Label>{t('penaltySettings.penaltyLimits.maximumMonthlyPenalty', 'Maximum Monthly Penalty (Rp)')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={generalSettings.maximum_monthly_penalty || ''}
                    onChange={(e) => 
                      setGeneralSettings(prev => ({ ...prev, maximum_monthly_penalty: parseFloat(e.target.value) || 0 }))
                    }
                    placeholder={t('penaltySettings.penaltyLimits.unlimited', 'Unlimited')}
                  />
                </div>

                <div>
                  <Label>{t('penaltySettings.penaltyLimits.defaultHourlyRate', 'Default Penalty Hourly Rate (Rp)')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={generalSettings.default_hourly_rate}
                    onChange={(e) => 
                      setGeneralSettings(prev => ({ ...prev, default_hourly_rate: parseFloat(e.target.value) || 0 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('penaltySettings.penaltyLimits.defaultHourlyRateDescription', 'Used for hourly penalty calculation')}
                  </p>
                </div>

                <div>
                  <Label>{t('penaltySettings.penaltyLimits.defaultSalaryPercentage', 'Default Salary Percentage (%)')}</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={generalSettings.default_salary_percentage}
                    onChange={(e) => 
                      setGeneralSettings(prev => ({ ...prev, default_salary_percentage: parseFloat(e.target.value) || 0 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('penaltySettings.penaltyLimits.defaultSalaryPercentageDescription', 'Used for penalty calculation based on salary percentage')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {t('penaltySettings.holidayRules.title', 'Holiday Rules')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={holidaySettings.apply_on_holidays}
                    onCheckedChange={(checked) => 
                      setHolidaySettings(prev => ({ ...prev, apply_on_holidays: checked }))
                    }
                  />
                  <Label>{t('penaltySettings.holidayRules.applyOnNationalHolidays', 'Apply penalty on national holidays')}</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={holidaySettings.apply_on_weekends}
                    onCheckedChange={(checked) => 
                      setHolidaySettings(prev => ({ ...prev, apply_on_weekends: checked }))
                    }
                  />
                  <Label>{t('penaltySettings.holidayRules.applyOnWeekends', 'Apply penalty on weekends')}</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t('penaltySettings.graceSettings.title', 'Grace Settings')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={graceSettings.first_offense_grace}
                    onCheckedChange={(checked) => 
                      setGraceSettings(prev => ({ ...prev, first_offense_grace: checked }))
                    }
                  />
                  <Label>{t('penaltySettings.graceSettings.firstOffenseGrace', 'Give grace for first offense')}</Label>
                </div>

                <div>
                  <Label>{t('penaltySettings.graceSettings.monthlyGraceLimit', 'Monthly Grace Limit')}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={graceSettings.monthly_grace_limit}
                    onChange={(e) => 
                      setGraceSettings(prev => ({ ...prev, monthly_grace_limit: parseInt(e.target.value) || 0 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('penaltySettings.graceSettings.monthlyGraceLimitDescription', 'Maximum number of violations tolerated per month')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveGeneralSettings} className="min-w-[120px]">
              {t('penaltySettings.saveSettings', 'Save Settings')}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">{t('penaltySettings.rules.title', 'Penalty Rules')}</h3>
            <PenaltyRuleFormDialog />
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {t('penaltySettings.rules.activeRules', 'Active Penalty Rules')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {rules.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertTriangle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">{t('penaltySettings.rules.noRules', 'No penalty rules configured yet')}</h3>
                    <p className="text-sm mb-4">
                      {t('penaltySettings.rules.noRulesDescription', 'Create penalty rules to automate late penalty calculation')}
                    </p>
                    <PenaltyRuleFormDialog isCompact={false} />
                  </div>
                ) : (
                  rules.map((rule) => (
                    <Card key={rule.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{rule.name}</h4>
                            <Badge variant={rule.is_active ? "default" : "secondary"}>
                              {rule.is_active ? t('penaltySettings.status.active', 'Active') : t('penaltySettings.status.inactive', 'Inactive')}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {rule.calculation_type === 'fixed' && t('penaltySettings.calculationTypes.fixed.title', 'Fixed Penalty')}
                              {rule.calculation_type === 'hourly' && t('penaltySettings.calculationTypes.hourly.title', 'Per Hour')}
                              {rule.calculation_type === 'salary_percentage' && t('penaltySettings.calculationTypes.salaryPercentage.title', 'Salary Percentage')}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEditRule(rule)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteRule(rule.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium text-gray-900">{t('penaltySettings.rules.violationType', 'Violation Type')}:</span>
                            <br />
                            <span className="capitalize">
                              {rule.rule_type.replace('_', ' ')}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">{t('penaltySettings.rules.timeThreshold', 'Time Threshold')}:</span>
                            <br />
                            {applyVariables(t('penaltySettings.rules.minutes', '{{minutes}} minutes'), { minutes: String(rule.threshold_minutes) })}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">{t('penaltySettings.rules.calculation', 'Calculation')}:</span>
                            <br />
                            {rule.calculation_type === 'fixed' && `${formatCurrency(rule.penalty_amount)}`}
                            {rule.calculation_type === 'hourly' && `${formatCurrency(rule.hourly_rate || 0)}${t('penaltySettings.rules.perHour', '/hour')}`}
                            {rule.calculation_type === 'salary_percentage' && `${rule.salary_percentage}% ${t('penaltySettings.rules.salary', 'salary')}`}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">{t('penaltySettings.rules.maximumLimit', 'Maximum Limit')}:</span>
                            <br />
                            {rule.max_penalty_per_month ? formatCurrency(rule.max_penalty_per_month) : t('penaltySettings.penaltyLimits.unlimited', 'Unlimited')}
                          </div>
                        </div>
                        
                        {rule.description && (
                          <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
                            <span className="font-medium">{t('penaltySettings.rules.description', 'Description')}: </span>
                            {rule.description}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exemptions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">{t('penaltySettings.exemptions.title', 'Penalty Exemptions')}</h3>
            <Dialog open={isExemptionDialogOpen} onOpenChange={setIsExemptionDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetExemptionForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('penaltySettings.exemptions.addExemption', 'Add Exemption')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingExemption ? t('penaltySettings.exemptions.editTitle', 'Edit Exemption') : t('penaltySettings.exemptions.addTitle', 'Add Exemption')}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-600">
                    {t('penaltySettings.exemptions.description', 'Give penalty exemption for specific employees, set effective period, and determine which rules are exempted.')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>{t('penaltySettings.exemptions.employee', 'Employee')}</Label>
                    <Select 
                      value={exemptionForm.employee_id}
                      onValueChange={(value) => setExemptionForm(prev => ({ ...prev, employee_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('penaltySettings.exemptions.selectEmployee', 'Select employee')} />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{t('penaltySettings.exemptions.penaltyRule', 'Penalty Rule (Optional)')}</Label>
                    <Select 
                      value={exemptionForm.penalty_rule_id}
                      onValueChange={(value) => setExemptionForm(prev => ({ ...prev, penalty_rule_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('penaltySettings.exemptions.allRules', 'All rules')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('penaltySettings.exemptions.allRules', 'All rules')}</SelectItem>
                        {rules.map((rule) => (
                          <SelectItem key={rule.id} value={rule.id}>
                            {rule.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{t('penaltySettings.exemptions.exemptionType', 'Exemption Type')}</Label>
                    <Select 
                      value={exemptionForm.exemption_type}
                      onValueChange={(value) => setExemptionForm(prev => ({ ...prev, exemption_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="temporary">{t('penaltySettings.exemptions.temporary', 'Temporary')}</SelectItem>
                        <SelectItem value="permanent">{t('penaltySettings.exemptions.permanent', 'Permanent')}</SelectItem>
                        <SelectItem value="conditional">{t('penaltySettings.exemptions.conditional', 'Conditional')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{t('penaltySettings.exemptions.startDate', 'Start Date')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {exemptionForm.start_date ? format(exemptionForm.start_date, "PPP", { locale: dateLocale }) : t('datePicker.selectDate', 'Select date')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={exemptionForm.start_date}
                          onSelect={(date) => date && setExemptionForm(prev => ({ ...prev, start_date: date }))}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {exemptionForm.exemption_type === 'temporary' && (
                    <div>
                      <Label>{t('penaltySettings.exemptions.endDate', 'End Date')}</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {exemptionForm.end_date ? format(exemptionForm.end_date, "PPP", { locale: dateLocale }) : t('datePicker.selectDate', 'Select date')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={exemptionForm.end_date}
                            onSelect={(date) => setExemptionForm(prev => ({ ...prev, end_date: date }))}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  <div>
                    <Label>{t('penaltySettings.exemptions.reason', 'Reason')}</Label>
                    <Textarea
                      value={exemptionForm.reason}
                      onChange={(e) => setExemptionForm(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder={t('penaltySettings.exemptions.reasonPlaceholder', 'Enter exemption reason...')}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsExemptionDialogOpen(false)}>
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button onClick={handleCreateExemption}>
                      {editingExemption ? t('common.update', 'Update') : t('penaltySettings.exemptions.add', 'Add')}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {exemptions.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">{t('penaltySettings.exemptions.noExemptions', 'No exemptions yet')}</h3>
                  <p className="text-muted-foreground mb-4">
                    {t('penaltySettings.exemptions.noExemptionsDescription', 'Create exemptions for employees who are not subject to certain penalties.')}
                  </p>
                  <Button onClick={() => setIsExemptionDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('penaltySettings.exemptions.addFirstExemption', 'Add First Exemption')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              exemptions.map((exemption) => (
                <Card key={exemption.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">
                            {employees.find(e => e.id === exemption.employee_id)?.full_name || t('penaltySettings.exemptions.unknownEmployee', 'Unknown Employee')}
                          </h4>
                          <Badge variant={exemption.is_active ? "default" : "secondary"}>
                            {exemption.is_active ? t('penaltySettings.status.active', 'Active') : t('penaltySettings.status.inactive', 'Inactive')}
                          </Badge>
                          <Badge variant="outline">
                            {exemption.exemption_type}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">{t('penaltySettings.exemptions.start', 'Start')}:</span> {format(new Date(exemption.start_date), "dd/MM/yyyy")}
                          </div>
                          {exemption.end_date && (
                            <div>
                              <span className="font-medium">{t('penaltySettings.exemptions.end', 'End')}:</span> {format(new Date(exemption.end_date), "dd/MM/yyyy")}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">{t('penaltySettings.exemptions.reason', 'Reason')}:</span> {exemption.reason}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingExemption(exemption);
                          setIsExemptionDialogOpen(true);
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                          if (confirm(t('penaltySettings.exemptions.confirmDelete', 'Are you sure you want to delete this exemption?'))) {
                            deleteExemption(exemption.id);
                          }
                        }}>
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

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t('penaltySettings.notifications.title', 'Notification Settings')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={notificationSettings.notify_employee}
                  onCheckedChange={(checked) => 
                    setNotificationSettings(prev => ({ ...prev, notify_employee: checked }))
                  }
                />
                <Label>{t('penaltySettings.notifications.notifyEmployee', 'Notify employee when penalty is applied')}</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={notificationSettings.notify_manager}
                  onCheckedChange={(checked) => 
                    setNotificationSettings(prev => ({ ...prev, notify_manager: checked }))
                  }
                />
                <Label>{t('penaltySettings.notifications.notifyManager', 'Notify direct manager')}</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={notificationSettings.notify_hr}
                  onCheckedChange={(checked) => 
                    setNotificationSettings(prev => ({ ...prev, notify_hr: checked }))
                  }
                />
                <Label>{t('penaltySettings.notifications.notifyHr', 'Notify HR team')}</Label>
              </div>

              <div className="pt-4">
                <Button onClick={handleSaveGeneralSettings}>
                  {t('penaltySettings.notifications.saveSettings', 'Save Notification Settings')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Rule Dialog */}
      {isRuleDialogOpen && (
        <PenaltyRuleFormDialog 
          editingRule={editingRule}
          onClose={handleRuleDialogClose}
        />
      )}
    </div>
  );
};
