import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Calendar, Plus, X } from 'lucide-react';
import { useAttendanceHolidays } from '@/features/2-3-settings/hooks/useLocationManagement';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';

interface ManualHolidayFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ManualHolidayForm = ({ onSuccess, onCancel }: ManualHolidayFormProps) => {
  const { createHoliday } = useAttendanceHolidays();
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    is_active: true,
    is_recurring: false,
    recurring_type: '',
    applies_to_attendance: true,
    country_code: 'ID'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.date) {
      toast({
        title: "Error",
        description: "Nama hari libur dan tanggal harus diisi",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const holidayData = {
        name: formData.name.trim(),
        date: formData.date,
        is_active: formData.is_active,
        is_recurring: formData.is_recurring,
        recurring_type: formData.is_recurring ? 'yearly' : null,
        applies_to_attendance: formData.applies_to_attendance,
        country_code: formData.country_code,
        organization_id: organizationId
      };

      const result = await createHoliday(holidayData);
      
      if (result) {
        toast({
          title: "Sukses",
          description: "Hari libur berhasil ditambahkan",
        });
        
        // Reset form
        setFormData({
          name: '',
          date: '',
          is_active: true,
          is_recurring: false,
          recurring_type: '',
          applies_to_attendance: true,
          country_code: 'ID'
        });
        
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error creating holiday:', error);
      toast({
        title: "Error",
        description: "Gagal menambahkan hari libur",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Tambah Hari Libur Manual
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="holiday-name">Nama Hari Libur</Label>
              <Input
                id="holiday-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="contoh: Hari Raya Idul Fitri"
                required
              />
            </div>

            <div>
              <Label htmlFor="holiday-date">Tanggal</Label>
              <Input
                id="holiday-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="country-code">Kode Negara</Label>
              <Input
                id="country-code"
                value={formData.country_code}
                onChange={(e) => setFormData(prev => ({ ...prev, country_code: e.target.value }))}
                placeholder="ID"
                maxLength={2}
              />
            </div>

            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is-active">Aktifkan hari libur</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is-recurring"
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_recurring: checked }))}
                />
                <Label htmlFor="is-recurring">Hari libur berulang setiap tahun</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="applies-to-attendance"
                  checked={formData.applies_to_attendance}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, applies_to_attendance: checked }))}
                />
                <Label htmlFor="applies-to-attendance">Berlaku untuk sistem absensi</Label>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({
                  name: '',
                  date: '',
                  is_active: true,
                  is_recurring: false,
                  recurring_type: '',
                  applies_to_attendance: true,
                  country_code: 'ID'
                });
                onCancel?.();
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting}
            >
              <Plus className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Menyimpan...' : 'Tambah Hari Libur'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
