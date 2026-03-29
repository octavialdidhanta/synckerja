
import { Card, CardContent } from '@/shared/components/ui/card';
import { useUpdateEmployee } from '../../hooks';
import { PersonalInfoForm } from './PersonalInfoForm';

interface PersonalInfoTabProps {
  employee: any;
  isEditMode: boolean;
  onUpdate: () => void;
}

export const PersonalInfoTab = ({ employee, isEditMode, onUpdate }: PersonalInfoTabProps) => {
  const updateEmployee = useUpdateEmployee();

  const handleSave = async (formData: any): Promise<boolean> => {
    if (!employee?.id) return false;
    
    try {
      console.log('PersonalInfoTab: Updating employee with data:', formData);
      
      const updatePayload = {
        full_name: formData.full_name,
        email: formData.email,
        mobile_phone: formData.mobile_phone,
        birth_date: formData.birth_date,
        birth_place: formData.birth_place,
        gender: formData.gender,
        nik: formData.nik,
        religion: formData.religion,
        marital_status: formData.marital_status,
        updated_at: new Date().toISOString(),
      };

      console.log('PersonalInfoTab: Final update payload:', updatePayload);
      
      await updateEmployee.mutateAsync({
        id: employee.id,
        data: updatePayload
      });
      
      // onUpdate() removed - React Query auto-handles invalidation & refetch
      return true;
    } catch (error) {
      console.error('Error updating personal info:', error);
      return false;
    }
  };

  // Expose the save function globally for backward compatibility
  if (typeof window !== 'undefined') {
    (window as any).savePersonalInfo = async () => {
      const formData = (window as any).personalInfoFormData;
      if (formData) {
        return await handleSave(formData);
      }
      return false;
    };
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <PersonalInfoForm
            employee={employee}
            isEditMode={isEditMode}
            onSave={handleSave}
            isLoading={updateEmployee.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
};
