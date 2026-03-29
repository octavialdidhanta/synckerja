import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { JobOpeningFormData } from '../hooks/jobOpeningTypes';

/** Format number with dot as thousand separator (e.g. 8000000 -> "8.000.000") */
function formatSalaryDisplay(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return '';
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Parse display string back to number (e.g. "8.000.000" -> 8000000) */
function parseSalaryInput(raw: string): number | undefined {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return undefined;
  const num = parseInt(digits, 10);
  return isNaN(num) ? undefined : num;
}

interface JobOpeningBasicInfoTabProps {
  formData: JobOpeningFormData;
  onInputChange: (field: keyof JobOpeningFormData, value: any) => void;
  departments?: Array<{ id: string; name: string }>;
  jobPositions?: Array<{ id: string; name: string; department_id?: string }>;
  jobLevels?: Array<{ id: string; name: string }>;
  employeeStatuses?: Array<{ id: string; name: string }>;
}

export const JobOpeningBasicInfoTab = ({
  formData,
  onInputChange,
  departments,
  jobPositions,
  jobLevels,
  employeeStatuses
}: JobOpeningBasicInfoTabProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="job_title">Job Title *</Label>
          <Input
            id="job_title"
            value={formData.job_title}
            onChange={(e) => onInputChange('job_title', e.target.value)}
            placeholder="e.g., Senior Software Engineer"
            required
          />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => onInputChange('location', e.target.value)}
            placeholder="e.g., Jakarta, Remote, Hybrid"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="department_id">Department *</Label>
          <Select 
            value={formData.department_id} 
            onValueChange={(value) => onInputChange('department_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="job_position_id">Position</Label>
          <Select 
            value={formData.job_position_id} 
            onValueChange={(value) => onInputChange('job_position_id', value)}
            disabled={!formData.department_id || !jobPositions || jobPositions.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                !formData.department_id 
                  ? "Select department first" 
                  : !jobPositions || jobPositions.length === 0
                  ? "No positions available"
                  : "Select position"
              } />
            </SelectTrigger>
            <SelectContent>
              {jobPositions && jobPositions.length > 0 ? (
                jobPositions.map((pos) => (
                  <SelectItem key={pos.id} value={pos.id}>
                    {pos.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-positions" disabled>
                  No positions available for this department
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="job_level_id">Job Level</Label>
          <Select value={formData.job_level_id} onValueChange={(value) => onInputChange('job_level_id', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select job level" />
            </SelectTrigger>
            <SelectContent>
              {jobLevels?.map((level) => (
                <SelectItem key={level.id} value={level.id}>
                  {level.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="employment_status_id">Employment Status</Label>
          <Select value={formData.employment_status_id} onValueChange={(value) => onInputChange('employment_status_id', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select employment status" />
            </SelectTrigger>
            <SelectContent>
              {employeeStatuses?.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="salary_min">Minimum Salary</Label>
          <Input
            id="salary_min"
            type="text"
            inputMode="numeric"
            value={formatSalaryDisplay(formData.salary_min)}
            onChange={(e) => onInputChange('salary_min', parseSalaryInput(e.target.value))}
            placeholder="e.g., 8.000.000"
          />
        </div>
        <div>
          <Label htmlFor="salary_max">Maximum Salary</Label>
          <Input
            id="salary_max"
            type="text"
            inputMode="numeric"
            value={formatSalaryDisplay(formData.salary_max)}
            onChange={(e) => onInputChange('salary_max', parseSalaryInput(e.target.value))}
            placeholder="e.g., 15.000.000"
          />
        </div>
        <div>
          <Label htmlFor="closing_date">Closing Date</Label>
          <Input
            id="closing_date"
            type="date"
            value={formData.closing_date || ''}
            onChange={(e) => onInputChange('closing_date', e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select value={formData.status} onValueChange={(value: any) => onInputChange('status', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
