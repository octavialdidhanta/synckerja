
import { FileUpload } from '@/shared/components/ui/file-upload';
import { PersonalDataStepProps } from '../types';

export const DocumentUploadSection = ({ formData, handleInputChange }: PersonalDataStepProps) => {
  return (
    <div className="border-t pt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Document Upload</h3>
      <div className="space-y-4">
        <FileUpload
          id="id_card"
          label="ID Card (KTP) *"
          value={formData.id_card_file}
          onChange={(value) => handleInputChange('id_card_file', value || '')}
          accept=".pdf,.jpg,.jpeg,.png"
          required
        />

        <FileUpload
          id="family_card"
          label="Family Card (KK)"
          value={formData.family_card_file}
          onChange={(value) => handleInputChange('family_card_file', value || '')}
          accept=".pdf,.jpg,.jpeg,.png"
          required={false}
        />

        <FileUpload
          id="cv"
          label="CV/Resume"
          value={formData.cv_file}
          onChange={(value) => handleInputChange('cv_file', value || '')}
          accept=".pdf"
          required={false}
        />
      </div>
    </div>
  );
};
