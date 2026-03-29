
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { PersonalDataStepProps } from '../types';

export const AddressSection = ({ formData, handleInputChange }: PersonalDataStepProps) => {
  return (
    <div className="space-y-2 md:col-span-2">
      <Label htmlFor="address" className="text-sm font-medium text-gray-700">
        Address
      </Label>
      <Textarea
        id="address"
        value={formData.address || ''}
        onChange={e => handleInputChange('address', e.target.value)}
        placeholder="Enter address"
        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[80px] text-sm resize-none"
      />
    </div>
  );
};


