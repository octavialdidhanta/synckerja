import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { Shield, Camera, Clock, AlertTriangle, Save } from 'lucide-react';
import { useWorkScheduleSettings } from '@/2-1-employees/MyInfo/Attendance/hooks/useWorkScheduleSettings';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useReportAttendanceSettingsLoading } from '@/2-3-attendance/context/AttendancePageLoadContext';

export const AttendanceRulesSettings = () => {
  const { t } = useAppTranslation();
  const { settings: schedules, loading: schedulesLoading } = useWorkScheduleSettings();
  useReportAttendanceSettingsLoading(schedulesLoading);

  const [formData, setFormData] = useState({
    work_schedule_id: '',
    enforce_national_holidays: true,
    allow_weekend_attendance: false,
    require_photo_checkin: false,
    require_photo_checkout: false,
    auto_checkout_enabled: false,
    auto_checkout_time: '18:00',
    max_radius_meters: 100,
    gps_accuracy_threshold: 50,
    require_gps_accuracy: true,
    allow_manual_location: false,
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Save to work schedule settings instead of location settings
      console.log('Saving attendance rules:', formData);
    } finally {
      setSaving(false);
    }
  };

  if (schedulesLoading) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-2xl font-semibold">{t('attendanceRules.title', 'Attendance Rules')}</h2>
          <p className="text-muted-foreground mt-1">{t('attendanceRules.description', 'Configure rules and validation for the attendance system')}</p>
        </div>
        <Button 
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? t('attendanceRules.saving', 'Saving...') : t('attendanceRules.saveSettings', 'Save Settings')}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Schedule Assignment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('attendanceRules.defaultWorkSchedule.title', 'Default Work Schedule')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="work_schedule">{t('attendanceRules.defaultWorkSchedule.selectLabel', 'Select Work Schedule')}</Label>
              <Select 
                value={formData.work_schedule_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, work_schedule_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('attendanceRules.defaultWorkSchedule.placeholder', 'Select default work schedule')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-schedule">{t('attendanceRules.defaultWorkSchedule.noSchedule', 'No special schedule')}</SelectItem>
                  {schedules.map((schedule) => (
                    <SelectItem key={schedule.id} value={schedule.id}>
                      {schedule.name} ({schedule.start_time} - {schedule.end_time})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                {t('attendanceRules.defaultWorkSchedule.description', 'This schedule will be used as default for attendance validation')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Holiday and Weekend Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t('attendanceRules.holidayWeekend.title', 'Holiday & Weekend Rules')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>{t('attendanceRules.holidayWeekend.applyNationalHolidays', 'Apply National Holidays')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('attendanceRules.holidayWeekend.applyNationalHolidaysDescription', 'System will exclude national holidays from attendance requirements')}
                  </p>
                </div>
                <Switch
                  checked={formData.enforce_national_holidays}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enforce_national_holidays: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>{t('attendanceRules.holidayWeekend.allowWeekendAttendance', 'Allow Weekend Attendance')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('attendanceRules.holidayWeekend.allowWeekendAttendanceDescription', 'Employees can perform attendance on Saturday and Sunday')}
                  </p>
                </div>
                <Switch
                  checked={formData.allow_weekend_attendance}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allow_weekend_attendance: checked }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Photo Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {t('attendanceRules.photoRequirements.title', 'Photo Requirements')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>{t('attendanceRules.photoRequirements.requirePhotoCheckin', 'Require Photo on Check-in')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('attendanceRules.photoRequirements.requirePhotoCheckinDescription', 'Employees must take a selfie photo when checking in')}
                  </p>
                </div>
                <Switch
                  checked={formData.require_photo_checkin}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, require_photo_checkin: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>{t('attendanceRules.photoRequirements.requirePhotoCheckout', 'Require Photo on Check-out')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('attendanceRules.photoRequirements.requirePhotoCheckoutDescription', 'Employees must take a selfie photo when checking out')}
                  </p>
                </div>
                <Switch
                  checked={formData.require_photo_checkout}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, require_photo_checkout: checked }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auto Checkout */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('attendanceRules.autoCheckout.title', 'Auto Check-out')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>{t('attendanceRules.autoCheckout.enable', 'Enable Auto Check-out')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('attendanceRules.autoCheckout.enableDescription', 'System will automatically perform check-out at the specified time')}
                </p>
              </div>
              <Switch
                checked={formData.auto_checkout_enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_checkout_enabled: checked }))}
              />
            </div>

            {formData.auto_checkout_enabled && (
              <div>
                <Label htmlFor="auto_checkout_time">{t('attendanceRules.autoCheckout.time', 'Auto Check-out Time')}</Label>
                <Input
                  id="auto_checkout_time"
                  type="time"
                  value={formData.auto_checkout_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, auto_checkout_time: e.target.value }))}
                  className="w-48"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('attendanceRules.locationRules.title', 'Location Rules')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="max_radius">{t('attendanceRules.locationRules.maxRadius', 'Maximum Radius (meters)')}</Label>
                <Input
                  id="max_radius"
                  type="number"
                  min="10"
                  max="1000"
                  value={formData.max_radius_meters}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_radius_meters: parseInt(e.target.value) || 100 }))}
                />
              </div>

              <div>
                <Label htmlFor="gps_accuracy">{t('attendanceRules.locationRules.gpsAccuracyThreshold', 'GPS Accuracy Threshold (meters)')}</Label>
                <Input
                  id="gps_accuracy"
                  type="number"
                  min="5"
                  max="100"
                  value={formData.gps_accuracy_threshold}
                  onChange={(e) => setFormData(prev => ({ ...prev, gps_accuracy_threshold: parseInt(e.target.value) || 50 }))}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>{t('attendanceRules.locationRules.requireGpsAccuracy', 'Require GPS Accuracy')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('attendanceRules.locationRules.requireGpsAccuracyDescription', 'Reject attendance if GPS accuracy does not meet threshold')}
                  </p>
                </div>
                <Switch
                  checked={formData.require_gps_accuracy}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, require_gps_accuracy: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>{t('attendanceRules.locationRules.allowManualLocation', 'Allow Manual Location')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('attendanceRules.locationRules.allowManualLocationDescription', 'Employees can enter location coordinates manually')}
                  </p>
                </div>
                <Switch
                  checked={formData.allow_manual_location}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allow_manual_location: checked }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Summary */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>{t('attendanceRules.status.currentConfiguration', 'Current Configuration Status:')}</strong></p>
              <div className="flex flex-wrap gap-2">
                {formData.enforce_national_holidays && <Badge variant="secondary">{t('attendanceRules.status.nationalHolidays', 'National Holidays')}</Badge>}
                {formData.allow_weekend_attendance && <Badge variant="secondary">{t('attendanceRules.status.weekendAllowed', 'Weekend Allowed')}</Badge>}
                {formData.require_photo_checkin && <Badge variant="secondary">{t('attendanceRules.status.photoCheckin', 'Photo Check-in')}</Badge>}
                {formData.require_photo_checkout && <Badge variant="secondary">{t('attendanceRules.status.photoCheckout', 'Photo Check-out')}</Badge>}
                {formData.auto_checkout_enabled && <Badge variant="secondary">{t('attendanceRules.status.autoCheckout', 'Auto Check-out')}</Badge>}
                {formData.require_gps_accuracy && <Badge variant="secondary">{t('attendanceRules.status.gpsAccuracy', 'GPS Accuracy')}</Badge>}
                {formData.allow_manual_location && <Badge variant="secondary">{t('attendanceRules.status.manualLocation', 'Manual Location')}</Badge>}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};
