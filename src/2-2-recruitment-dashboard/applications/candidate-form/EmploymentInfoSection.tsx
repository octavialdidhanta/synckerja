
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Lock } from 'lucide-react';

interface EmploymentInfoData {
  department_id: string;
  job_position_id: string;
  job_level_id: string;
  branch_id: string;
  employee_status_id: string;
  join_date: string;
  hire_date: string;
  employment_status: string;
}

interface EmploymentInfoSectionProps {
  formData: EmploymentInfoData;
  onChange: (field: string, value: string) => void;
  departments: Array<{ id: string; name: string }>;
  jobPositions: Array<{ id: string; name: string }>;
  jobLevels: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
  employeeStatuses: Array<{ id: string; name: string }>;
}

export function EmploymentInfoSection({ 
  formData, 
  onChange, 
  departments = [],
  jobPositions = [],
  jobLevels = [],
  branches = [],
  employeeStatuses = []
}: EmploymentInfoSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Lock className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-700">Employment Information</h3>
      </div>

      <Alert className="mb-4">
        <Lock className="h-4 w-4" />
        <AlertDescription>
          This section is read-only for candidates. Employment information will be filled by the recruiter after the application is approved.
        </AlertDescription>
      </Alert>

      <div className="space-y-4 opacity-60 pointer-events-none">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="department_id">Department</Label>
            <Select value={formData.department_id || ''} disabled>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="job_position_id">Job Position</Label>
            <Select value={formData.job_position_id || ''} disabled>
              <SelectTrigger>
                <SelectValue placeholder="Select job position" />
              </SelectTrigger>
              <SelectContent>
                {jobPositions.map((position) => (
                  <SelectItem key={position.id} value={position.id}>
                    {position.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="job_level_id">Job Level</Label>
            <Select value={formData.job_level_id || ''} disabled>
              <SelectTrigger>
                <SelectValue placeholder="Select job level" />
              </SelectTrigger>
              <SelectContent>
                {jobLevels.map((level) => (
                  <SelectItem key={level.id} value={level.id}>
                    {level.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="branch_id">Branch</Label>
            <Select value={formData.branch_id || ''} disabled>
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="employee_status_id">Employee Status</Label>
            <Select value={formData.employee_status_id || ''} disabled>
              <SelectTrigger>
                <SelectValue placeholder="Select employee status" />
              </SelectTrigger>
              <SelectContent>
                {employeeStatuses.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="employment_status">Employment Status</Label>
            <Input
              id="employment_status"
              value={formData.employment_status || 'pending'}
              disabled
              placeholder="Employment status"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="join_date">Join Date</Label>
            <Input
              id="join_date"
              type="date"
              value={formData.join_date || ''}
              disabled
            />
          </div>

          <div>
            <Label htmlFor="hire_date">Hire Date</Label>
            <Input
              id="hire_date"
              type="date"
              value={formData.hire_date || ''}
              disabled
            />
          </div>
        </div>
      </div>
    </div>
  );
}
