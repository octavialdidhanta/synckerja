
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { PersonalDataStepProps } from '../types';
import { useState, useEffect } from 'react';
import { useEmployeeValidation } from '../../hooks/useEmployeeValidation';
import { EmployeeFormData } from '@/types/forms';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export const IdentitySection = ({ formData, handleInputChange }: PersonalDataStepProps) => {
  const [nikValidation, setNikValidation] = useState<{
    isValid: boolean | null;
    message: string;
    isChecking: boolean;
  }>({
    isValid: null,
    message: '',
    isChecking: false
  });

  const { validateNikFormat, checkNikUniqueness } = useEmployeeValidation(formData as EmployeeFormData);

  // Debounced NIK validation
  useEffect(() => {
    const nik = formData.nik?.trim();
    
    if (!nik) {
      setNikValidation({
        isValid: null,
        message: '',
        isChecking: false
      });
      return;
    }

    // Clear previous validation
    setNikValidation(prev => ({ ...prev, isChecking: true, message: '' }));

    // Debounce the validation check
    const timeoutId = setTimeout(async () => {
      // First check format
      if (!validateNikFormat(nik)) {
        setNikValidation({
          isValid: false,
          message: 'NIK must be exactly 16 digits',
          isChecking: false
        });
        return;
      }

      // Then check uniqueness
      const result = await checkNikUniqueness(nik);
      setNikValidation({
        isValid: result.isValid,
        message: result.message,
        isChecking: false
      });
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [formData.nik]);

  const getInputClassName = () => {
    let baseClass = "border-gray-300 focus-visible:border-primary focus-visible:ring-primary text-sm";

    if (nikValidation.isChecking) {
      return `${baseClass} border-yellow-300`;
    } else if (nikValidation.isValid === true) {
      return `${baseClass} border-green-500`;
    } else if (nikValidation.isValid === false) {
      return `${baseClass} border-red-500`;
    }

    return baseClass;
  };

  const getValidationIcon = () => {
    if (nikValidation.isChecking) {
      return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
    } else if (nikValidation.isValid === true) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (nikValidation.isValid === false) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="nik" className="text-sm font-medium text-gray-700">
        NIK (16 digit) <span className="text-red-500">*</span>
      </Label>
      <div className="relative">
        <Input
          id="nik"
          value={formData.nik || ''}
          onChange={e => handleInputChange('nik', e.target.value.replace(/\D/g, ''))}
          placeholder="Enter NIK (16 digits)"
          maxLength={16}
          className={getInputClassName()}
        />
        {getValidationIcon() && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {getValidationIcon()}
          </div>
        )}
      </div>
      {nikValidation.message && (
        <p className={`text-xs ${
          nikValidation.isValid === true ? 'text-green-600' :
          nikValidation.isValid === false ? 'text-red-600' :
          'text-gray-600'
        }`}>
          {nikValidation.message}
        </p>
      )}
    </div>
  );
};

