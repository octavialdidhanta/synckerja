import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Wifi, Globe, Edit, Save, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Switch } from '@/shared/components/ui/switch';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { toast } from 'sonner';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useReportAttendanceSettingsLoading } from '@/2-3-attendance/context/AttendancePageLoadContext';
import { format } from 'date-fns';
import { id, enUS } from 'date-fns/locale';

interface AllowedIP {
  id: string;
  ip_address: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export const IPAddressSettings = () => {
  const { t, dateLocale } = useAppTranslation();
  const [allowedIPs, setAllowedIPs] = useState<AllowedIP[]>([]);
  const [loading, setLoading] = useState(false);
  const [listBootstrapDone, setListBootstrapDone] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    ip_address: '',
    name: '',
    description: '',
    is_active: true
  });
  const { data: employee, isPending: employeePending } = useCurrentEmployee();

  const ipPanelLoading = employeePending || !listBootstrapDone;
  useReportAttendanceSettingsLoading(ipPanelLoading);

  useEffect(() => {
    if (!employeePending && !employee?.organization_id) {
      setListBootstrapDone(true);
    }
  }, [employeePending, employee?.organization_id]);

  useEffect(() => {
    if (employee?.organization_id) {
      fetchAllowedIPs();
    }
  }, [employee?.organization_id]);

  const fetchAllowedIPs = async () => {
    if (!employee?.organization_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('allowed_ip_addresses')
        .select('*')
        .eq('organization_id', employee.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllowedIPs(data || []);
    } catch (error) {
      console.error('Error fetching allowed IPs:', error);
      toast.error(t('ipAddress.failedToLoad', 'Failed to load IP address list'));
    } finally {
      setLoading(false);
      setListBootstrapDone(true);
    }
  };

  const validateIPAddress = (ip: string): boolean => {
    // Basic IP validation (IPv4 and CIDR notation)
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/;
    return ipv4Regex.test(ip);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee?.organization_id) return;

    if (!validateIPAddress(formData.ip_address)) {
      toast.error(t('ipAddress.invalidFormat', 'Invalid IP address format. Use format like 192.168.1.1 or 192.168.1.0/24'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('allowed_ip_addresses')
        .insert({
          organization_id: employee.organization_id,
          ip_address: formData.ip_address,
          name: formData.name,
          description: formData.description,
          is_active: formData.is_active,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      toast.success(t('ipAddress.addedSuccessfully', 'IP address added successfully'));
      setFormData({ ip_address: '', name: '', description: '', is_active: true });
      setShowAddForm(false);
      fetchAllowedIPs();
    } catch (error: any) {
      console.error('Error adding IP:', error);
      if (error.code === '23505') {
        toast.error(t('ipAddress.alreadyExists', 'IP address already exists in the list'));
      } else {
        toast.error(t('ipAddress.failedToAdd', 'Failed to add IP address'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('allowed_ip_addresses')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success(!currentStatus ? t('ipAddress.activated', 'IP address activated') : t('ipAddress.deactivated', 'IP address deactivated'));
      fetchAllowedIPs();
    } catch (error) {
      console.error('Error updating IP status:', error);
      toast.error(t('ipAddress.failedToUpdateStatus', 'Failed to update IP address status'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('ipAddress.confirmDelete', 'Are you sure you want to delete this IP address?'))) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('allowed_ip_addresses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(t('ipAddress.deletedSuccessfully', 'IP address deleted successfully'));
      fetchAllowedIPs();
    } catch (error) {
      console.error('Error deleting IP:', error);
      toast.error(t('ipAddress.failedToDelete', 'Failed to delete IP address'));
    } finally {
      setLoading(false);
    }
  };

  if (ipPanelLoading) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t('ipAddress.management', 'IP Address Management')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('ipAddress.managementDescription', 'Manage the list of allowed IP addresses for attendance from laptop/computer')}
          </p>
        </div>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={loading}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('ipAddress.addIP', 'Add IP')}
        </Button>
      </div>

      <Alert>
        <Wifi className="h-4 w-4" />
        <AlertDescription>
          {t('ipAddress.alertDescription', 'IP address is used as a fallback when GPS is not available (laptop/computer). Use format like 192.168.1.1 for single IP or 192.168.1.0/24 for range.')}
        </AlertDescription>
      </Alert>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('ipAddress.addNewIP', 'Add New IP Address')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ip_address">{t('ipAddress.ipAddress', 'IP Address')} *</Label>
                  <Input
                    id="ip_address"
                    value={formData.ip_address}
                    onChange={(e) => setFormData(prev => ({ ...prev, ip_address: e.target.value }))}
                    placeholder={t('ipAddress.ipAddressPlaceholder', '192.168.1.1 or 192.168.1.0/24')}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('ipAddress.useSlash24', 'Use /24 for network range (example: 192.168.1.0/24)')}
                  </p>
                </div>
                <div>
                  <Label htmlFor="name">{t('ipAddress.nameLabel', 'Name/Label')} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('ipAddress.namePlaceholder', 'Main Office WiFi')}
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">{t('ipAddress.description', 'Description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('ipAddress.descriptionPlaceholder', 'Optional description for this IP address')}
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">{t('ipAddress.active', 'Active')}</Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {t('common.save', 'Save')}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddForm(false)}
                  disabled={loading}
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {allowedIPs.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t('ipAddress.noIPConfigured', 'No IP addresses configured yet')}</p>
              <p className="text-sm text-muted-foreground">{t('ipAddress.addFirstIP', 'Add the first IP address to start using this feature')}</p>
            </CardContent>
          </Card>
        ) : (
          allowedIPs.map((ip) => (
            <Card key={ip.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Wifi className="h-4 w-4 text-primary" />
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {ip.ip_address}
                        </code>
                      </div>
                      <Badge variant={ip.is_active ? "default" : "secondary"}>
                        {ip.is_active ? t('ipAddress.active', 'Active') : t('ipAddress.inactive', 'Inactive')}
                      </Badge>
                    </div>
                    
                    <div className="mt-2">
                      <h4 className="font-medium text-foreground">{ip.name}</h4>
                      {ip.description && (
                        <p className="text-sm text-muted-foreground mt-1">{ip.description}</p>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('ipAddress.added', 'Added')}: {format(new Date(ip.created_at), 'PP', { locale: dateLocale })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={ip.is_active}
                      onCheckedChange={() => handleToggleActive(ip.id, ip.is_active)}
                      disabled={loading}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(ip.id)}
                      disabled={loading}
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
    </div>
  );
};
