
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { useUpdateEmployee } from '../../hooks';
import { MapPin } from 'lucide-react';

interface AddressInfoTabProps {
  employee: any;
  isEditMode: boolean;
  onUpdate: () => void;
}

export const AddressInfoTab = ({ employee, isEditMode, onUpdate }: AddressInfoTabProps) => {
  const [formData, setFormData] = useState({
    address: employee?.address || '',
    citizen_address: employee?.citizen_address || '',
  });

  const updateEmployee = useUpdateEmployee();

  useEffect(() => {
    if (employee) {
      setFormData({
        address: employee.address || '',
        citizen_address: employee.citizen_address || '',
      });
    }
  }, [employee]);

  const handleInputChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleSave = async (data: typeof formData): Promise<boolean> => {
    if (!employee?.id) return false;
    
    try {
      await updateEmployee.mutateAsync({
        id: employee.id,
        data
      });
      // onUpdate() removed - React Query auto-handles invalidation & refetch
      return true;
    } catch (error) {
      console.error('Error updating address info:', error);
      return false;
    }
  };

  // Expose the save function to parent component for backward compatibility
  useEffect(() => {
    if (employee?.id && typeof onUpdate === 'function') {
      window.addressTabSave = () => handleSave(formData);
    }
    
    return () => {
      delete window.addressTabSave;
    };
  }, [employee?.id, formData]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Address Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Current Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                disabled={!isEditMode}
                rows={3}
                placeholder="Enter current address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="citizen_address">Citizen Address (KTP)</Label>
              <Textarea
                id="citizen_address"
                value={formData.citizen_address}
                onChange={(e) => handleInputChange('citizen_address', e.target.value)}
                disabled={!isEditMode}
                rows={3}
                placeholder="Enter citizen address as per ID card"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
