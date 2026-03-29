
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { EmploymentDataStepProps } from '../types';
import { EMPLOYEE_ROLES } from '../../hooks/roles';

const roleOptions = [
  { value: EMPLOYEE_ROLES.EMPLOYEE, label: 'Employee' },
  { value: EMPLOYEE_ROLES.MANAGER, label: 'Manager' },
  { value: EMPLOYEE_ROLES.HR, label: 'HR' },
  { value: EMPLOYEE_ROLES.ADMIN, label: 'Admin' },
  { value: EMPLOYEE_ROLES.OWNER, label: 'Owner' },
];

export const AccessPermissionsSection = ({ formData, handleInputChange }: EmploymentDataStepProps) => {
  return (
    <div className="border-t pt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Access & Permissions</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label htmlFor="role" className="text-sm font-medium">
            System Role <span className="text-red-500">*</span>
          </Label>
          <Select 
            value={formData.role || 'employee'} 
            onValueChange={(value) => handleInputChange('role', value)}
          >
            <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500">
              <SelectValue placeholder="Select user role" />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};


