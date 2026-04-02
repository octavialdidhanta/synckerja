
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { useUpdateEmployee } from '../../hooks';
import { useDepartmentsCrud } from '@/shared/hooks/crudMaster/useDepartmentsCrud';
import { useJobPositionsCrud } from '@/shared/hooks/crudMaster/useJobPositionsCrud';
import { useJobLevelsCrud } from '@/shared/hooks/crudMaster/useJobLevelsCrud';
import { useBranchesCrud } from '@/shared/hooks/crudMaster/useBranchesCrud';
import { useEmployeeStatusesCrud } from '@/shared/hooks/crudMaster/useEmployeeStatusesCrud';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { Briefcase, Plus, ChevronDown, MoreVertical, Edit, Trash2 } from 'lucide-react';

interface EmploymentInfoTabProps {
  employee: any;
  isEditMode: boolean;
  onUpdate: () => void;
}

export const EmploymentInfoTab = ({ employee, isEditMode, onUpdate }: EmploymentInfoTabProps) => {
  const { organizationId } = useCurrentOrg();
  const [modalInputValue, setModalInputValue] = useState('');
  
  // Initialize form data first
  const [formData, setFormData] = useState(() => {
    console.log('EmploymentInfoTab: Initial state employee:', employee);
    
    // Format dates properly on initial render
    let formattedJoinDate = '';
    let formattedHireDate = '';
    
    if (employee?.join_date) {
      const joinDate = new Date(employee.join_date);
      if (!isNaN(joinDate.getTime())) {
        formattedJoinDate = joinDate.toISOString().split('T')[0];
      }
    }
    
    if (employee?.hire_date) {
      const hireDate = new Date(employee.hire_date);
      if (!isNaN(hireDate.getTime())) {
        formattedHireDate = hireDate.toISOString().split('T')[0];
      }
    }
    
    console.log('EmploymentInfoTab: Initial formatted join_date:', formattedJoinDate);
    console.log('EmploymentInfoTab: Initial formatted hire_date:', formattedHireDate);
    
    return {
      employee_id: employee?.employee_id || '',
      department_id: employee?.department_id || '',
      job_position_id: employee?.job_position_id || '',
      job_level_id: employee?.job_level_id || '',
      branch_id: employee?.branch_id || '',
      employee_status_id: employee?.employee_status_id || '',
      join_date: formattedJoinDate,
      hire_date: formattedHireDate,
    };
  });
  
  // Initialize CRUD hooks
  const departmentsCrud = useDepartmentsCrud(organizationId);
  const jobPositionsCrud = useJobPositionsCrud(organizationId, { department_id: formData.department_id });
  const jobLevelsCrud = useJobLevelsCrud(organizationId);

  // Update modal input value when modal opens
  useEffect(() => {
    if (departmentsCrud.modalOpen) {
      setModalInputValue(departmentsCrud.editItem?.name || '');
    } else if (jobPositionsCrud.modalOpen) {
      setModalInputValue(jobPositionsCrud.editItem?.name || '');
    } else if (jobLevelsCrud.modalOpen) {
      setModalInputValue(jobLevelsCrud.editItem?.name || '');
    } else {
      setModalInputValue('');
    }
  }, [
    departmentsCrud.modalOpen, 
    departmentsCrud.editItem,
    jobPositionsCrud.modalOpen,
    jobPositionsCrud.editItem,
    jobLevelsCrud.modalOpen,
    jobLevelsCrud.editItem
  ]);

  // CustomDropdown component for CRUD functionality
  const CustomDropdown = ({ 
    label, 
    value, 
    onChange, 
    options, 
    isLoading, 
    onAdd, 
    onEdit, 
    onDelete, 
    placeholder,
    disabled 
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ id: string; name: string; isDefault?: boolean }>;
    isLoading: boolean;
    onAdd: () => void;
    onEdit: (item: { id: string; name: string; isDefault?: boolean }) => void;
    onDelete: (id: string) => void;
    placeholder: string;
    disabled?: boolean;
  }) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium">{label} <span className="text-red-500">*</span></label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="h-6 px-2 text-xs"
          disabled={disabled}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between text-sm h-10 px-3"
            disabled={isLoading || disabled}
          >
            <span className="truncate">
              {isLoading 
                ? "Loading..." 
                : value 
                ? options.find(opt => opt.id === value)?.name || placeholder
                : placeholder
              }
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full min-w-[var(--radix-dropdown-menu-trigger-width)] bg-white border shadow-md">
          {!isLoading && options.map((option) => (
            <div key={option.id} className="flex items-center">
              <DropdownMenuItem
                onClick={() => onChange(option.id)}
                className="flex-1 cursor-pointer text-xs py-2 px-3"
              >
                {option.name}
                {option.isDefault && " (Default)"}
              </DropdownMenuItem>
              {!option.isDefault && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 mx-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white border shadow-md">
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(option);
                      }}
                      className="text-xs"
                    >
                      <Edit className="h-3 w-3 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(option.id);
                      }}
                      className="text-red-600 text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
          {!isLoading && options.length === 0 && (
            <DropdownMenuItem disabled className="text-xs text-gray-500">
              No options available
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const updateEmployee = useUpdateEmployee();
  
  // Fetch master data
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
      let formattedJoinDate = '';
      let formattedHireDate = '';
      
      if (employee.join_date) {
        const joinDate = new Date(employee.join_date);
        if (!isNaN(joinDate.getTime())) {
          formattedJoinDate = joinDate.toISOString().split('T')[0];
        }
      }
      
      if (employee.hire_date) {
        const hireDate = new Date(employee.hire_date);
        if (!isNaN(hireDate.getTime())) {
          formattedHireDate = hireDate.toISOString().split('T')[0];
        }
      }
      
      console.log('EmploymentInfoTab: Formatted join_date:', formattedJoinDate);
      console.log('EmploymentInfoTab: Formatted hire_date:', formattedHireDate);
      
      const employmentData = {
        employee_id: employee.employee_id || '',
        department_id: employee.department_id || '',
        job_position_id: employee.job_position_id || '',
        job_level_id: employee.job_level_id || '',
        branch_id: employee.branch_id || '',
        employee_status_id: employee.employee_status_id || '',
        join_date: formattedJoinDate,
        hire_date: formattedHireDate,
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

            <CustomDropdown
              label="Department"
              value={formData.department_id}
              onChange={(value) => handleInputChange('department_id', value)}
              options={departmentsCrud.data || []}
              isLoading={departmentsCrud.isLoading}
              onAdd={departmentsCrud.openAddModal}
              onEdit={departmentsCrud.openEditModal}
              onDelete={departmentsCrud.deleteItem}
              placeholder="Select department"
              disabled={!isEditMode || isSaving}
            />

            <CustomDropdown
              label="Job Position"
              value={formData.job_position_id}
              onChange={(value) => handleInputChange('job_position_id', value)}
              options={filteredJobPositions}
              isLoading={jobPositionsCrud.isLoading}
              onAdd={jobPositionsCrud.openAddModal}
              onEdit={jobPositionsCrud.openEditModal}
              onDelete={jobPositionsCrud.deleteItem}
              placeholder={!formData.department_id ? "Select department first" : "Select job position"}
              disabled={!isEditMode || isSaving || !formData.department_id}
            />
            {!formData.department_id && (
              <p className="text-sm text-gray-500">Please select a department first</p>
            )}

            <CustomDropdown
              label="Job Level"
              value={formData.job_level_id}
              onChange={(value) => handleInputChange('job_level_id', value)}
              options={jobLevelsCrud.data || []}
              isLoading={jobLevelsCrud.isLoading}
              onAdd={jobLevelsCrud.openAddModal}
              onEdit={jobLevelsCrud.openEditModal}
              onDelete={jobLevelsCrud.deleteItem}
              placeholder="Select job level"
              disabled={!isEditMode || isSaving}
            />

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

      {/* Department CRUD Modal */}
      {departmentsCrud.modalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          style={{ 
            zIndex: 9999,
            position: 'fixed'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              departmentsCrud.closeModal();
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">
              {departmentsCrud.editItem?.id ? 'Edit Department' : 'Add Department'}
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="department-name">Department Name</Label>
                <Input
                  id="department-name"
                  value={modalInputValue}
                  onChange={(e) => setModalInputValue(e.target.value)}
                  placeholder="Enter department name"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={departmentsCrud.closeModal}
                  disabled={departmentsCrud.saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (modalInputValue.trim()) {
                      departmentsCrud.saveItem(modalInputValue.trim());
                    }
                  }}
                  disabled={departmentsCrud.saving || !modalInputValue.trim()}
                >
                  {departmentsCrud.saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Job Position CRUD Modal */}
      {jobPositionsCrud.modalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          style={{ 
            zIndex: 9999,
            position: 'fixed'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              jobPositionsCrud.closeModal();
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">
              {jobPositionsCrud.editItem?.id ? 'Edit Job Position' : 'Add Job Position'}
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="job-position-name">Job Position Name</Label>
                <Input
                  id="job-position-name"
                  value={modalInputValue}
                  onChange={(e) => setModalInputValue(e.target.value)}
                  placeholder="Enter job position name"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={jobPositionsCrud.closeModal}
                  disabled={jobPositionsCrud.saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (modalInputValue.trim()) {
                      jobPositionsCrud.saveItem(modalInputValue.trim());
                    }
                  }}
                  disabled={jobPositionsCrud.saving || !modalInputValue.trim()}
                >
                  {jobPositionsCrud.saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Job Level CRUD Modal */}
      {jobLevelsCrud.modalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          style={{ 
            zIndex: 9999,
            position: 'fixed'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              jobLevelsCrud.closeModal();
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">
              {jobLevelsCrud.editItem?.id ? 'Edit Job Level' : 'Add Job Level'}
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="job-level-name">Job Level Name</Label>
                <Input
                  id="job-level-name"
                  value={modalInputValue}
                  onChange={(e) => setModalInputValue(e.target.value)}
                  placeholder="Enter job level name"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={jobLevelsCrud.closeModal}
                  disabled={jobLevelsCrud.saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (modalInputValue.trim()) {
                      jobLevelsCrud.saveItem(modalInputValue.trim());
                    }
                  }}
                  disabled={jobLevelsCrud.saving || !modalInputValue.trim()}
                >
                  {jobLevelsCrud.saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
