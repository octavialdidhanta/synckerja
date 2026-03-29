
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { EmploymentDataStepProps } from '../types';

export const JobInformationSection = ({ formData, handleInputChange }: EmploymentDataStepProps) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="employee_id" className="text-sm font-medium">Employee ID</Label>
          <Input
            id="employee_id"
            value={formData.employee_id || ''}
            onChange={(e) => handleInputChange('employee_id', e.target.value)}
            placeholder="Auto-generated if empty"
            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-gray-50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="join_date" className="text-sm font-medium">
            Join Date <span className="text-red-500">*</span>
          </Label>
          <Input
            id="join_date"
            type="date"
            value={formData.join_date || ''}
            onChange={(e) => handleInputChange('join_date', e.target.value)}
            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
};


