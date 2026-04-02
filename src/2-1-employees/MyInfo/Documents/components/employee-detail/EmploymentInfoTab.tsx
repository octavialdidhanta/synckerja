
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useUpdateEmployee } from '../../hooks';
import { useDepartmentsCrud } from '@/shared/hooks/crudMaster/useDepartmentsCrud';
import { useJobPositionsCrud } from '@/shared/hooks/crudMaster/useJobPositionsCrud';
import { useJobLevelsCrud } from '@/shared/hooks/crudMaster/useJobLevelsCrud';
import { useBranchesCrud } from '@/shared/hooks/crudMaster/useBranchesCrud';
import { useEmployeeStatusesCrud } from '@/shared/hooks/crudMaster/useEmployeeStatusesCrud';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { Briefcase } from 'lucide-react';

interface EmploymentInfoTabProps {
  employee: any;
  isEditMode: boolean;
  onUpdate: () => void;
}

export const EmploymentInfoTab = ({ employee, isEditMode, onUpdate }: EmploymentInfoTabProps) => {
  const { organizationId } = useCurrentOrg();
  const [formData, setFormData] = useState(() => {
    console.log('EmploymentInfoTab: Initial state employee:', employee);
    
    // Format dates properly on initial render
    // Fix: Use hire_date as the actual join date to sync with employees list
    let formattedJoinDate = '';
    let formattedHireDate = '';
    
    if (employee?.hire_date) {
      const joinDate = new Date(employee.hire_date);
      if (!isNaN(joinDate.getTime())) {
        formattedJoinDate = joinDate.toISOString().split('T')[0];
      }
    }
    
    if (employee?.join_date) {
      const hireDate = new Date(employee.join_date);
      if (!isNaN(hireDate.getTime())) {
        formattedHireDate = hireDate.toISOString().split('T')[0];
      }
    }
    
    console.log('EmploymentInfoTab: Initial formatted join_date (from hire_date):', formattedJoinDate);
    console.log('EmploymentInfoTab: Initial formatted hire_date (from join_date):', formattedHireDate);
    
    return {
      employee_id: employee?.employee_id || '',
      department_id: employee?.department_id || '',
      job_position_id: employee?.job_position_id || '',
      job_level_id: employee?.job_level_id || '',
      branch_id: employee?.branch_id || '',
      employee_status_id: employee?.employee_status_id || '',
      join_date: formattedJoinDate, // This now uses hire_date from DB
      hire_date: formattedHireDate,  // This now uses join_date from DB
    };
  });

  const updateEmployee = useUpdateEmployee();
  
  // Fetch master data
  const departmentsCrud = useDepartmentsCrud(organizationId);
  const jobPositionsCrud = useJobPositionsCrud(organizationId, { department_id: formData.department_id });
  const jobLevelsCrud = useJobLevelsCrud(organizationId);
  const branchesCrud = useBranchesCrud(organizationId);
  const employeeStatusesCrud = useEmployeeStatusesCrud(organizationId);

  // Filter job positions based on selected department
  const filteredJobPositions = jobPositionsCrud.data?.filter(position => {
    if (!formData.department_id) {
      // If no department selected, show only global positions (no department_id)
      return !position.department_id;
    }
    // Show positions for selected department + global positions
    return position.department_id === formData.department_id || !position.department_id;
  }) || [];

  useEffect(() => {
    if (employee) {
      console.log('EmploymentInfoTab: Raw employee data:', employee);
      console.log('EmploymentInfoTab: join_date value:', employee.join_date);
      console.log('EmploymentInfoTab: hire_date value:', employee.hire_date);
      
      // Format dates properly if they exist
      // Based on the issue: the actual join date is stored in hire_date field
      let formattedJoinDate = '';
      let formattedHireDate = '';
      
      // Fix: Use hire_date as the actual join date to sync with employees list
      if (employee.hire_date) {
        const joinDate = new Date(employee.hire_date);
        if (!isNaN(joinDate.getTime())) {
          formattedJoinDate = joinDate.toISOString().split('T')[0];
        }
      }
      
      // Keep hire_date empty for now or use join_date if it exists
      if (employee.join_date) {
        const hireDate = new Date(employee.join_date);
        if (!isNaN(hireDate.getTime())) {
          formattedHireDate = hireDate.toISOString().split('T')[0];
        }
      }
      
      console.log('EmploymentInfoTab: Formatted join_date (from hire_date):', formattedJoinDate);
      console.log('EmploymentInfoTab: Formatted hire_date (from join_date):', formattedHireDate);
      
      const employmentData = {
        employee_id: employee.employee_id || '',
        department_id: employee.department_id || '',
        job_position_id: employee.job_position_id || '',
        job_level_id: employee.job_level_id || '',
        branch_id: employee.branch_id || '',
        employee_status_id: employee.employee_status_id || '',
        join_date: formattedJoinDate, // This now uses hire_date from DB
        hire_date: formattedHireDate,  // This now uses join_date from DB
      };
      
      console.log('EmploymentInfoTab: Final employment data:', employmentData);
      setFormData(employmentData);
      
      // Expose form data globally for backward compatibility
      if (typeof window !== 'undefined') {
        (window as any).employmentInfoFormData = employmentData;
      }
    }
  }, [employee]);

  const handleInputChange = (field: string, value: string) => {
    console.log('EmploymentInfoTab: Field changed:', field, 'New value:', value);
    
    let newFormData = {
      ...formData,
      [field]: value
    };

    // If department changes, clear job position selection
    if (field === 'department_id') {
      newFormData = {
        ...newFormData,
        job_position_id: '' // Clear job position when department changes
      };
    }

    setFormData(newFormData);
    
    // Update global form data for backward compatibility
    if (typeof window !== 'undefined') {
      (window as any).employmentInfoFormData = newFormData;
    }
    
    // Trigger auto-save if in edit mode
    if (isEditMode) {
      triggerSave(newFormData);
    }
  };

  const handleSave = async (data: typeof formData): Promise<boolean> => {
    if (!employee?.id) return false;
    
    try {
      console.log('EmploymentInfoTab: Saving employment data:', data);
      
      const updateData = {
        department_id: data.department_id || null,
        job_position_id: data.job_position_id || null,
        job_level_id: data.job_level_id || null,
        branch_id: data.branch_id || null,
        employee_status_id: data.employee_status_id || null,
        join_date: data.join_date || null,
        hire_date: data.hire_date || null,
        employee_id: data.employee_id,
        updated_at: new Date().toISOString(),
      };
      
      console.log('EmploymentInfoTab: Final update payload:', updateData);
      
      await updateEmployee.mutateAsync({
        id: employee.id,
        data: updateData
      });
      
      console.log('EmploymentInfoTab: Update successful, refreshing data');
      
      // onUpdate() removed - React Query auto-handles invalidation & refetch
      // setTimeout removed - no need to manually refetch
      
      return true;
    } catch (error) {
      console.error('Error updating employment info:', error);
      return false;
    }
  };

  const { isSaving, lastSaved, hasUnsavedChanges, triggerSave } = useAutoSave({
    onSave: handleSave,
    enabledCondition: isEditMode
  });

  // Expose the save function globally for backward compatibility
  if (typeof window !== 'undefined') {
    (window as any).saveEmploymentInfo = () => {
      return handleSave(formData);
    };
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Briefcase className="h-5 w-5" />
              <span>Employment Information</span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee_id">Employee ID</Label>
              <Input
                id="employee_id"
                value={formData.employee_id}
                disabled={true}
                className="bg-gray-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department_id">Department <span className="text-red-500">*</span></Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) => handleInputChange('department_id', value)}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departmentsCrud.data?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="job_position_id">Job Position</Label>
              <Select
                value={formData.job_position_id}
                onValueChange={(value) => handleInputChange('job_position_id', value)}
                disabled={!isEditMode || isSaving || !formData.department_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!formData.department_id ? "Select department first" : "Select job position"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredJobPositions.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.name} {position.isDefault ? "(Default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!formData.department_id && (
                <p className="text-sm text-gray-500">Please select a department first</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="job_level_id">Job Level</Label>
              <Select
                value={formData.job_level_id}
                onValueChange={(value) => handleInputChange('job_level_id', value)}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select job level" />
                </SelectTrigger>
                <SelectContent>
                  {jobLevelsCrud.data?.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name} {level.organization_id === null ? "(Default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch_id">Branch</Label>
              <Select
                value={formData.branch_id}
                onValueChange={(value) => handleInputChange('branch_id', value)}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branchesCrud.data?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_status_id">Employee Status</Label>
              <Select
                value={formData.employee_status_id}
                onValueChange={(value) => handleInputChange('employee_status_id', value)}
                disabled={!isEditMode || isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee status" />
                </SelectTrigger>
                <SelectContent>
                  {employeeStatusesCrud.data?.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="join_date">Join Date</Label>
              <Input
                id="join_date"
                type="date"
                value={formData.join_date}
                onChange={(e) => handleInputChange('join_date', e.target.value)}
                disabled={!isEditMode || isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hire_date">Hire Date</Label>
              <Input
                id="hire_date"
                type="date"
                value={formData.hire_date}
                onChange={(e) => handleInputChange('hire_date', e.target.value)}
                disabled={!isEditMode || isSaving}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
