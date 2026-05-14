
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { PersonalDataStepProps } from './types';
import { PersonalDetailsSection } from './personal-info/PersonalDetailsSection';
import { IdentitySection } from './personal-info/IdentitySection';
import { AddressSection } from './personal-info/AddressSection';
import { DocumentUploadSection } from './personal-info/DocumentUploadSection';

export const PersonalInfoStep = ({ formData, handleInputChange }: PersonalDataStepProps) => {
  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-8">
        {/* Personal Information — single 2-column grid for consistent layout */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
          <p className="text-xs text-gray-500 mb-4">
            Fields marked <span className="text-red-500">*</span> are required.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <PersonalDetailsSection formData={formData} handleInputChange={handleInputChange} />
            <IdentitySection formData={formData} handleInputChange={handleInputChange} />
            <AddressSection formData={formData} handleInputChange={handleInputChange} />
          </div>
        </div>

        <DocumentUploadSection formData={formData} handleInputChange={handleInputChange} />
      </div>
    </ScrollArea>
  );
};
