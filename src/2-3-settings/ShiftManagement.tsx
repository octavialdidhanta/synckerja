import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Clock, Users, Save, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Switch } from '@/shared/components/ui/switch';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';

interface Shift {
  id: string;
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  break_duration_minutes: number;
  late_tolerance_minutes: number;
  is_active: boolean;
  organization_id: string;
}

export const ShiftManagement = () => {
  const { t } = useAppTranslation();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_time: '',
    end_time: '',
    break_duration_minutes: 60,
    late_tolerance_minutes: 15,
    is_active: true
  });

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.active_organization_id) return;

      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('organization_id', profile.active_organization_id)
        .order('name');

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      toast({
        title: t('common.error', 'Error'),
        description: t('shiftManagement.error.loadFailed', 'Failed to load shift data'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      start_time: '',
      end_time: '',
      break_duration_minutes: 60,
      late_tolerance_minutes: 15,
      is_active: true
    });
    setEditingShift(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.active_organization_id) {
        toast({
          title: t('common.error', 'Error'),
          description: t('shiftManagement.error.organizationNotFound', 'Organization not found'),
          variant: "destructive"
        });
        return;
      }

      if (editingShift) {
        // Update existing shift
        const { error } = await supabase
          .from('shifts')
          .update(formData)
          .eq('id', editingShift.id);

        if (error) throw error;
        
        toast({
          title: t('common.success', 'Success'),
          description: t('shiftManagement.success.updated', 'Shift updated successfully')
        });
      } else {
        // Create new shift
        const { error } = await supabase
          .from('shifts')
          .insert({
            ...formData,
            organization_id: profile.active_organization_id
          });

        if (error) throw error;
        
        toast({
          title: t('common.success', 'Success'),
          description: t('shiftManagement.success.created', 'Shift created successfully')
        });
      }

      resetForm();
      setShowCreateDialog(false);
      fetchShifts();
    } catch (error) {
      console.error('Error saving shift:', error);
      toast({
        title: t('common.error', 'Error'),
        description: t('shiftManagement.error.saveFailed', 'Failed to save shift'),
        variant: "destructive"
      });
    }
  };

  const handleEdit = (shift: Shift) => {
    setFormData({
      name: shift.name,
      description: shift.description || '',
      start_time: shift.start_time,
      end_time: shift.end_time,
      break_duration_minutes: shift.break_duration_minutes,
      late_tolerance_minutes: shift.late_tolerance_minutes,
      is_active: shift.is_active
    });
    setEditingShift(shift);
    setShowCreateDialog(true);
  };

  const handleDelete = async (shiftId: string) => {
    if (!confirm(t('shiftManagement.confirmDelete', 'Are you sure you want to delete this shift?'))) return;

    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', shiftId);

      if (error) throw error;
      
      toast({
        title: t('common.success', 'Success'),
        description: t('shiftManagement.success.deleted', 'Shift deleted successfully')
      });
      
      fetchShifts();
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast({
        title: t('common.error', 'Error'),
        description: t('shiftManagement.error.deleteFailed', 'Failed to delete shift'),
        variant: "destructive"
      });
    }
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5); // Format HH:MM
  };

  if (loading) {
    return <div className="text-center py-8">{t('shiftManagement.loading', 'Loading shift data...')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">{t('shiftManagement.shiftList.title', 'Shift List')}</h3>
          <p className="text-sm text-gray-600">{t('shiftManagement.shiftList.description', 'Manage organization work shift schedule')}</p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t('shiftManagement.button.addShift', 'Add Shift')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingShift ? t('shiftManagement.form.editTitle', 'Edit Shift') : t('shiftManagement.form.addTitle', 'Add New Shift')}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                {t('shiftManagement.form.description', 'Set shift name, working hours, and tolerance for employee work schedule.')}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">{t('shiftManagement.form.shiftName', 'Shift Name')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('shiftManagement.form.shiftNamePlaceholder', 'e.g., Morning Shift')}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">{t('shiftManagement.form.descriptionLabel', 'Description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('shiftManagement.form.descriptionPlaceholder', 'Shift description...')}
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">{t('shiftManagement.form.startTime', 'Start Time')}</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="end_time">{t('shiftManagement.form.endTime', 'End Time')}</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="break_duration">{t('shiftManagement.form.breakDuration', 'Break Duration (minutes)')}</Label>
                  <Input
                    id="break_duration"
                    type="number"
                    value={formData.break_duration_minutes}
                    onChange={(e) => setFormData({ ...formData, break_duration_minutes: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
                
                <div>
                  <Label htmlFor="late_tolerance">{t('shiftManagement.form.lateTolerance', 'Late Tolerance (minutes)')}</Label>
                  <Input
                    id="late_tolerance"
                    type="number"
                    value={formData.late_tolerance_minutes}
                    onChange={(e) => setFormData({ ...formData, late_tolerance_minutes: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">{t('shiftManagement.form.shiftActive', 'Shift Active')}</Label>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {editingShift ? t('common.update', 'Update') : t('common.save', 'Save')}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCreateDialog(false)}
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {shifts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('shiftManagement.emptyState.title', 'No shifts yet')}</h3>
            <p className="text-gray-600 mb-4">{t('shiftManagement.emptyState.description', 'Start by creating your first work shift')}</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('shiftManagement.button.addShift', 'Add Shift')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {shifts.map((shift) => (
            <Card key={shift.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{shift.name}</CardTitle>
                      <p className="text-sm text-gray-600">{shift.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={shift.is_active ? "default" : "secondary"}>
                      {shift.is_active ? t('shiftManagement.status.active', 'Active') : t('shiftManagement.status.inactive', 'Inactive')}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(shift)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(shift.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">{t('shiftManagement.card.workingHours', 'Working Hours')}</p>
                    <p className="font-medium">
                      {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">{t('shiftManagement.card.break', 'Break')}</p>
                    <p className="font-medium">{applyVariables(t('shiftManagement.card.breakMinutes', '{{minutes}} minutes'), { minutes: String(shift.break_duration_minutes) })}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">{t('shiftManagement.card.lateTolerance', 'Late Tolerance')}</p>
                    <p className="font-medium">{applyVariables(t('shiftManagement.card.lateToleranceMinutes', '{{minutes}} minutes'), { minutes: String(shift.late_tolerance_minutes) })}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">{t('shiftManagement.card.status', 'Status')}</p>
                    <p className="font-medium">{shift.is_active ? t('shiftManagement.status.active', 'Active') : t('shiftManagement.status.inactive', 'Inactive')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
