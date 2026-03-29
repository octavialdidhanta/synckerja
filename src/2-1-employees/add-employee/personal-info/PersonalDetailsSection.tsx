
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { PersonalDataStepProps } from '../types';

const genderOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const maritalStatusOptions = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
];

const religionOptions = [
  { value: 'islam', label: 'Islam' },
  { value: 'christian', label: 'Christian' },
  { value: 'catholic', label: 'Catholic' },
  { value: 'hindu', label: 'Hindu' },
  { value: 'buddha', label: 'Buddha' },
  { value: 'confucius', label: 'Confucius' },
  { value: 'other', label: 'Other' },
];

const fieldClass = 'space-y-2';
const inputClass = 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm';

export const PersonalDetailsSection = ({ formData, handleInputChange }: PersonalDataStepProps) => {
  return (
    <>
      <div className={fieldClass}>
        <Label htmlFor="name" className="text-sm font-medium text-gray-700">
          Full Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          value={formData.name || ''}
          onChange={e => handleInputChange('name', e.target.value)}
          placeholder="Enter full name"
          className={inputClass}
        />
      </div>

      <div className={fieldClass}>
        <Label htmlFor="email" className="text-sm font-medium text-gray-700">
          Email <span className="text-red-500">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          value={formData.email || ''}
          onChange={e => handleInputChange('email', e.target.value)}
          placeholder="Enter email address"
          className={inputClass}
        />
      </div>

      <div className={fieldClass}>
        <Label htmlFor="mobile_phone" className="text-sm font-medium text-gray-700">
          Mobile Phone <span className="text-red-500">*</span>
        </Label>
        <Input
          id="mobile_phone"
          value={formData.mobile_phone || ''}
          onChange={e => handleInputChange('mobile_phone', e.target.value)}
          placeholder="Enter mobile phone number"
          className={inputClass}
        />
      </div>

      <div className={fieldClass}>
        <Label htmlFor="religion" className="text-sm font-medium text-gray-700">
          Religion
        </Label>
        <Select value={formData.religion || ''} onValueChange={value => handleInputChange('religion', value)}>
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="Select religion" />
          </SelectTrigger>
          <SelectContent>
            {religionOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={fieldClass}>
        <Label htmlFor="birth_date" className="text-sm font-medium text-gray-700">
          Birth Date
        </Label>
        <Input
          id="birth_date"
          type="date"
          value={formData.birth_date || ''}
          onChange={e => handleInputChange('birth_date', e.target.value)}
          className={inputClass}
        />
      </div>

      <div className={fieldClass}>
        <Label htmlFor="gender" className="text-sm font-medium text-gray-700">
          Gender
        </Label>
        <Select value={formData.gender || ''} onValueChange={value => handleInputChange('gender', value)}>
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            {genderOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={fieldClass}>
        <Label htmlFor="marital_status" className="text-sm font-medium text-gray-700">
          Marital Status
        </Label>
        <Select value={formData.marital_status || ''} onValueChange={value => handleInputChange('marital_status', value)}>
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="Select marital status" />
          </SelectTrigger>
          <SelectContent>
            {maritalStatusOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
};

