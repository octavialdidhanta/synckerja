
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { EmploymentDataStepProps } from './types';
import { JobInformationSection } from './sections/JobInformationSection';
import { DepartmentPositionSection } from './sections/DepartmentPositionSection';
import { EmploymentDetailsSection } from './sections/EmploymentDetailsSection';
import { AccessPermissionsSection } from './sections/AccessPermissionsSection';
import { EmploymentDocumentsSection } from './sections/EmploymentDocumentsSection';

export const EmploymentInfoStep = ({
  formData,
  handleInputChange
}: EmploymentDataStepProps) => {
  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-8">
        <JobInformationSection formData={formData} handleInputChange={handleInputChange} />
        <DepartmentPositionSection formData={formData} handleInputChange={handleInputChange} />
        <EmploymentDetailsSection formData={formData} handleInputChange={handleInputChange} />
        <AccessPermissionsSection formData={formData} handleInputChange={handleInputChange} />
        <EmploymentDocumentsSection formData={formData} handleInputChange={handleInputChange} />
      </div>
    </ScrollArea>
  );
};
