import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import {
  Shield,
  Calendar,
  MapPin,
  Camera,
  Clock,
  Info,
  Save,
} from 'lucide-react';
import { useWorkScheduleSettings } from '@/2-1-employees/MyInfo/Attendance/hooks/useWorkScheduleSettings';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';
import { useReportAttendanceSettingsLoading } from '@/2-3-attendance/context/AttendancePageLoadContext';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import {
  mergeAttendanceRulesSettings,
  useAttendanceRulesSettings,
  type AttendanceRulesSettingsRow,
} from '@/2-3-settings/hooks/useAttendanceRulesSettings';

const DAY_LABELS_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

interface OfficeLocationRow {
  id: string;
  name: string;
  radius_meters: number | null;
  is_active?: boolean | null;
}

function formatWorkingDays(days: number[]): string {
  if (!days?.length) return '—';
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS_ID[d - 1] ?? String(d))
    .join(', ');
}

export const AttendanceRulesSettings = () => {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const { settings: schedules, loading: schedulesLoading } = useWorkScheduleSettings();
  const { settings: savedSettings, settingsData, loading: rulesLoading, saveSettings, isSaving } =
    useAttendanceRulesSettings();
  const [form, setForm] = useState<AttendanceRulesSettingsRow | null>(null);
  const [officeLocations, setOfficeLocations] = useState<OfficeLocationRow[]>([]);

  const panelLoading = schedulesLoading || rulesLoading;
  useReportAttendanceSettingsLoading(panelLoading);

  // Sync from server when org or fetched row changes — not on every render (avoid resetting toggles).
  useEffect(() => {
    if (!organizationId || rulesLoading || !savedSettings) return;
    setForm({ ...savedSettings });
  }, [organizationId, settingsData, rulesLoading, savedSettings]);

  const fetchOfficeLocations = useCallback(async () => {
    if (!organizationId) return;
    const { data, error } = await supabase
      .from('office_locations')
      .select('id, name, radius_meters, is_active')
      .eq('organization_id', organizationId)
      .order('name');

    if (error) {
      console.error('Failed to load office locations:', error);
      setOfficeLocations([]);
      return;
    }
    setOfficeLocations((data ?? []).filter((row) => row.is_active !== false));
  }, [organizationId]);

  useEffect(() => {
    void fetchOfficeLocations();
  }, [fetchOfficeLocations]);

  const defaultSchedule = useMemo(
    () => schedules.find((s) => s.is_default) ?? schedules.find((s) => s.is_active) ?? schedules[0],
    [schedules],
  );

  const fallbackRadius = form?.default_max_radius_meters ?? 100;

  const updateField = <K extends keyof AttendanceRulesSettingsRow>(
    key: K,
    value: AttendanceRulesSettingsRow[K],
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!form) return;
    await saveSettings(form);
  };

  if (panelLoading || !form) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-foreground text-2xl font-semibold">
            {t('attendanceRules.title', 'Attendance Rules')}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t(
              'attendanceRules.description',
              'Configure rules and validation for the attendance system',
            )}
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving
            ? t('attendanceRules.saving', 'Saving...')
            : t('attendanceRules.saveSettings', 'Save Settings')}
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>{t('attendanceRules.holidayWeekend.weekendInfoTitle', 'Weekend policy')}</AlertTitle>
        <AlertDescription className="text-sm">
          {t(
            'attendanceRules.holidayWeekend.weekendManagedInWss',
            'Working days and weekend attendance are managed in the Work Schedule tab. Shift assignments can override non-working days.',
          )}
          {defaultSchedule ? (
            <span className="mt-1 block text-muted-foreground">
              {defaultSchedule.name}: {formatWorkingDays(defaultSchedule.working_days)}
            </span>
          ) : null}
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Badge variant={form.enforce_national_holidays ? 'default' : 'secondary'}>
          {t('attendanceRules.status.nationalHolidays', 'National Holidays')}:{' '}
          {form.enforce_national_holidays ? 'ON' : 'OFF'}
        </Badge>
        <Badge variant={form.require_photo_checkin ? 'default' : 'secondary'}>
          {t('attendanceRules.status.photoCheckin', 'Photo Check-in')}:{' '}
          {form.require_photo_checkin ? 'ON' : 'OFF'}
        </Badge>
        <Badge variant={form.require_photo_checkout ? 'default' : 'secondary'}>
          {t('attendanceRules.status.photoCheckout', 'Photo Check-out')}:{' '}
          {form.require_photo_checkout ? 'ON' : 'OFF'}
        </Badge>
        <Badge variant={form.auto_checkout_enabled ? 'default' : 'secondary'}>
          {t('attendanceRules.status.autoCheckout', 'Auto Check-out')}:{' '}
          {form.auto_checkout_enabled ? 'ON' : 'OFF'}
        </Badge>
        <Badge variant={form.require_gps_accuracy ? 'default' : 'secondary'}>
          {t('attendanceRules.status.gpsAccuracy', 'GPS Accuracy')}:{' '}
          {form.require_gps_accuracy ? 'ON' : 'OFF'}
        </Badge>
        <Badge variant={form.enable_visit_attendance_integration ? 'default' : 'secondary'}>
          {t('attendanceRules.status.visitIntegration', 'Visit Integration')}:{' '}
          {form.enable_visit_attendance_integration ? 'ON' : 'OFF'}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5" />
              {t('attendanceRules.holidayWeekend.title', 'Holiday & Weekend Rules')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="enforce-national-holidays">
                  {t('attendanceRules.holidayWeekend.applyNationalHolidays', 'Apply National Holidays')}
                </Label>
                <p className="text-muted-foreground text-xs">
                  {t(
                    'attendanceRules.holidayWeekend.applyNationalHolidaysDescription',
                    'System will exclude national holidays from attendance requirements',
                  )}
                </p>
              </div>
              <Switch
                id="enforce-national-holidays"
                checked={form.enforce_national_holidays}
                onCheckedChange={(checked) => updateField('enforce_national_holidays', checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-5 w-5" />
              {t('attendanceRules.photoRequirements.title', 'Photo Requirements')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="require-photo-checkin">
                  {t('attendanceRules.photoRequirements.requirePhotoCheckin', 'Require Photo on Check-in')}
                </Label>
                <p className="text-muted-foreground text-xs">
                  {t(
                    'attendanceRules.photoRequirements.requirePhotoCheckinDescription',
                    'Employees must take a selfie photo when checking in',
                  )}
                </p>
              </div>
              <Switch
                id="require-photo-checkin"
                checked={form.require_photo_checkin}
                onCheckedChange={(checked) => updateField('require_photo_checkin', checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="require-photo-checkout">
                  {t('attendanceRules.photoRequirements.requirePhotoCheckout', 'Require Photo on Check-out')}
                </Label>
                <p className="text-muted-foreground text-xs">
                  {t(
                    'attendanceRules.photoRequirements.requirePhotoCheckoutDescription',
                    'Employees must take a selfie photo when checking out',
                  )}
                </p>
              </div>
              <Switch
                id="require-photo-checkout"
                checked={form.require_photo_checkout}
                onCheckedChange={(checked) => updateField('require_photo_checkout', checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5" />
              {t('attendanceRules.autoCheckout.title', 'Auto Check-out')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="auto-checkout-enabled">
                  {t('attendanceRules.autoCheckout.enable', 'Enable Auto Check-out')}
                </Label>
                <p className="text-muted-foreground text-xs">
                  {t(
                    'attendanceRules.autoCheckout.enableDescription',
                    'System will automatically perform check-out at the specified time',
                  )}
                </p>
                <p className="text-muted-foreground text-xs italic">
                  {t(
                    'attendanceRules.autoCheckout.cronHint',
                    'Runs automatically every 15 minutes when enabled (pg_cron job attendance-auto-checkout-sql).',
                  )}
                </p>
              </div>
              <Switch
                id="auto-checkout-enabled"
                checked={form.auto_checkout_enabled}
                onCheckedChange={(checked) => updateField('auto_checkout_enabled', checked)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auto-checkout-time">
                {t('attendanceRules.autoCheckout.time', 'Auto Check-out Time')}
              </Label>
              <Input
                id="auto-checkout-time"
                type="time"
                value={form.auto_checkout_time.slice(0, 5)}
                onChange={(e) => updateField('auto_checkout_time', e.target.value)}
                disabled={!form.auto_checkout_enabled}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-5 w-5" />
              {t('attendanceRules.locationRules.title', 'Location Rules')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default-max-radius">
                {t('attendanceRules.locationRules.maxRadius', 'Maximum Radius (meters)')}
              </Label>
              <p className="text-muted-foreground text-xs">
                {t(
                  'attendanceRules.locationRules.maxRadiusDescription',
                  'Fallback radius when an office location has no radius configured.',
                )}
              </p>
              <Input
                id="default-max-radius"
                type="number"
                min={1}
                value={form.default_max_radius_meters}
                onChange={(e) =>
                  updateField('default_max_radius_meters', Math.max(1, Number(e.target.value) || 100))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gps-threshold">
                {t('attendanceRules.locationRules.gpsAccuracyThreshold', 'GPS Accuracy Threshold (meters)')}
              </Label>
              <Input
                id="gps-threshold"
                type="number"
                min={1}
                value={form.gps_accuracy_threshold_meters}
                onChange={(e) =>
                  updateField(
                    'gps_accuracy_threshold_meters',
                    Math.max(1, Number(e.target.value) || 50),
                  )
                }
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="require-gps-accuracy">
                  {t('attendanceRules.locationRules.requireGpsAccuracy', 'Require GPS Accuracy')}
                </Label>
                <p className="text-muted-foreground text-xs">
                  {t(
                    'attendanceRules.locationRules.requireGpsAccuracyDescription',
                    'Reject attendance if GPS accuracy does not meet threshold',
                  )}
                </p>
              </div>
              <Switch
                id="require-gps-accuracy"
                checked={form.require_gps_accuracy}
                onCheckedChange={(checked) => updateField('require_gps_accuracy', checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="allow-manual-location">
                  {t('attendanceRules.locationRules.allowManualLocation', 'Allow Manual Location')}
                </Label>
                <p className="text-muted-foreground text-xs">
                  {t(
                    'attendanceRules.locationRules.allowManualLocationDescription',
                    'Employees can enter location coordinates manually',
                  )}
                </p>
              </div>
              <Switch
                id="allow-manual-location"
                checked={form.allow_manual_location}
                onCheckedChange={(checked) => updateField('allow_manual_location', checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-5 w-5" />
              {t('attendanceRules.visitIntegration.title', 'Client Visit & Attendance')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>
                {t('attendanceRules.visitIntegration.explainerTitle', 'Three field-duty patterns')}
              </AlertTitle>
              <AlertDescription className="space-y-1 text-sm">
                <p>
                  {t(
                    'attendanceRules.visitIntegration.officeFirst',
                    'Office-first: visit later in the day and travel under threshold — morning check-in at office still required.',
                  )}
                </p>
                <p>
                  {t(
                    'attendanceRules.visitIntegration.fieldFirst',
                    'Field-first: visit starts near work start — use Start Visit at client site; attendance is recorded automatically.',
                  )}
                </p>
                <p>
                  {t(
                    'attendanceRules.visitIntegration.travelField',
                    'Travel field: long travel to client — no office morning check-in; check-in mandatory via Start Visit at client.',
                  )}
                </p>
              </AlertDescription>
            </Alert>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="enable-visit-integration">
                  {t(
                    'attendanceRules.visitIntegration.enable',
                    'Enable visit–attendance integration',
                  )}
                </Label>
                <p className="text-muted-foreground text-xs">
                  {t(
                    'attendanceRules.visitIntegration.enableDescription',
                    'Classify field days and auto clock-in when Start Visit begins at client site.',
                  )}
                </p>
              </div>
              <Switch
                id="enable-visit-integration"
                checked={form.enable_visit_attendance_integration}
                onCheckedChange={(checked) =>
                  updateField('enable_visit_attendance_integration', checked)
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="travel-threshold">
                  {t('attendanceRules.visitIntegration.travelThreshold', 'Travel threshold (minutes)')}
                </Label>
                <Input
                  id="travel-threshold"
                  type="number"
                  min={1}
                  value={form.travel_threshold_minutes}
                  disabled={!form.enable_visit_attendance_integration}
                  onChange={(e) =>
                    updateField(
                      'travel_threshold_minutes',
                      Math.max(1, Number(e.target.value) || 90),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-overlap">
                  {t('attendanceRules.visitIntegration.fieldOverlap', 'Field-first overlap (minutes)')}
                </Label>
                <Input
                  id="field-overlap"
                  type="number"
                  min={0}
                  value={form.field_first_overlap_minutes}
                  disabled={!form.enable_visit_attendance_integration}
                  onChange={(e) =>
                    updateField(
                      'field_first_overlap_minutes',
                      Math.max(0, Number(e.target.value) || 30),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="urban-speed">
                  {t('attendanceRules.visitIntegration.urbanSpeed', 'Urban travel speed (km/h)')}
                </Label>
                <Input
                  id="urban-speed"
                  type="number"
                  min={1}
                  value={form.urban_travel_speed_kmh}
                  disabled={!form.enable_visit_attendance_integration}
                  onChange={(e) =>
                    updateField(
                      'urban_travel_speed_kmh',
                      Math.max(1, Number(e.target.value) || 35),
                    )
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5" />
            {t('attendanceRules.effectiveNow.title', 'Effective now')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {t(
              'attendanceRules.effective.radiusSource',
              'Check-in radius comes from each office location (not from this page). Nearest active office wins.',
            )}{' '}
            {applyVariables(
              t(
                'attendanceRules.effective.radiusFallback',
                'Org fallback: {{m}} m when office radius is empty.',
              ),
              { m: String(fallbackRadius) },
            )}
          </p>
          {officeLocations.length === 0 ? (
            <p className="text-muted-foreground">
              {t('attendanceRules.effective.noOfficeLocations', 'No active office locations.')}
            </p>
          ) : (
            <div className="space-y-2">
              {officeLocations.map((loc) => (
                <div
                  key={loc.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="font-medium">{loc.name}</span>
                  <Badge variant="secondary">
                    {applyVariables(
                      t('attendanceRules.effective.radiusMeters', '{{m}} m radius'),
                      { m: String(loc.radius_meters ?? fallbackRadius) },
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {t(
              'attendanceRules.effective.shiftNote',
              'Shift-specific times and late tolerance use Employee Shift Settings and override work schedule hours.',
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
