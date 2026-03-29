
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

interface PersonalInfoFormProps {
  employee: any;
  isEditMode: boolean;
  onSave?: (formData: any) => Promise<boolean>;
  isLoading?: boolean;
}

const RELIGION_OPTIONS = [
  { value: 'islam', label: 'Islam' },
  { value: 'christian', label: 'Christian' },
  { value: 'catholic', label: 'Catholic' },
  { value: 'hindu', label: 'Hindu' },
  { value: 'buddha', label: 'Buddha' },
  { value: 'other', label: 'Other' }
];

const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' }
];

export const PersonalInfoForm = ({ employee, isEditMode, onSave, isLoading = false }: PersonalInfoFormProps) => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    mobile_phone: '',
    birth_date: '',
    birth_place: '',
    gender: '',
    nik: '',
    religion: '',
    marital_status: '',
  });

  const initialFormData = useMemo(() => ({
    full_name: employee?.full_name || '',
    email: employee?.email || '',
    mobile_phone: employee?.mobile_phone || '',
    birth_date: employee?.birth_date || '',
    birth_place: employee?.birth_place || '',
    gender: employee?.gender || '',
    nik: employee?.nik || '',
    religion: employee?.religion || '',
    marital_status: employee?.marital_status || '',
  }), [employee]);

  useEffect(() => {
    setFormData(initialFormData);
  }, [initialFormData]);

  const handleInputChange = useCallback((field: string, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
  }, [formData]);

  // Expose form data to parent component for unified saving
  useEffect(() => {
    if (onSave) {
      if (typeof window !== 'undefined') {
        window.personalInfoFormData = formData;
      }
    }
  }, [formData, onSave]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => handleInputChange('full_name', e.target.value)}
            disabled={!isEditMode || isLoading}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            disabled={!isEditMode || isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mobile_phone">Mobile Phone</Label>
          <Input
            id="mobile_phone"
            value={formData.mobile_phone}
            onChange={(e) => handleInputChange('mobile_phone', e.target.value)}
            disabled={!isEditMode || isLoading}
            placeholder="Enter mobile phone number"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="birth_date">Birth Date</Label>
          <Input
            id="birth_date"
            type="date"
            value={formData.birth_date}
            onChange={(e) => handleInputChange('birth_date', e.target.value)}
            disabled={!isEditMode || isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="birth_place">Birth Place</Label>
          <Input
            id="birth_place"
            value={formData.birth_place}
            onChange={(e) => handleInputChange('birth_place', e.target.value)}
            disabled={!isEditMode || isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select
            value={formData.gender}
            onValueChange={(value) => handleInputChange('gender', value)}
            disabled={!isEditMode || isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nik">NIK</Label>
          <Input
            id="nik"
            value={formData.nik}
            onChange={(e) => handleInputChange('nik', e.target.value)}
            disabled={!isEditMode || isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="religion">Religion</Label>
          <Select
            value={formData.religion}
            onValueChange={(value) => handleInputChange('religion', value)}
            disabled={!isEditMode || isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select religion" />
            </SelectTrigger>
            <SelectContent>
              {RELIGION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="marital_status">Marital Status</Label>
          <Select
            value={formData.marital_status}
            onValueChange={(value) => handleInputChange('marital_status', value)}
            disabled={!isEditMode || isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select marital status" />
            </SelectTrigger>
            <SelectContent>
              {MARITAL_STATUS_OPTIONS.map((option) => (
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
