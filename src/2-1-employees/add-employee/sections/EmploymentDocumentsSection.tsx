
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { EmploymentDataStepProps } from '../types';
import { Upload, File, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';

export const EmploymentDocumentsSection = ({ formData, handleInputChange }: EmploymentDataStepProps) => {
  const [contractFileName, setContractFileName] = useState<string>('');
  const [certificateFileName, setCertificateFileName] = useState<string>('');

  const handleContractChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setContractFileName(file.name);
      // Convert to base64 or handle file upload
      const reader = new FileReader();
      reader.onloadend = () => {
        handleInputChange('contract_file', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCertificateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCertificateFileName(file.name);
      // Convert to base64 or handle file upload
      const reader = new FileReader();
      reader.onloadend = () => {
        const currentFiles = formData.certificate_files || [];
        const updatedFiles = [...currentFiles, reader.result as string];
        handleInputChange('certificate_files', JSON.stringify(updatedFiles));
      };
      reader.readAsDataURL(file);
    }
  };

  const clearContract = () => {
    setContractFileName('');
    handleInputChange('contract_file', '');
  };

  const clearCertificate = () => {
    setCertificateFileName('');
    handleInputChange('certificate_files', JSON.stringify([]));
  };

  return (
    <div className="border-t pt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Employment Documents</h3>
      <div className="space-y-6">
        {/* Employment Contract */}
        <div className="space-y-2">
          <Label htmlFor="contract" className="text-sm font-medium">
            Employment Contract (PDF)
          </Label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-lg appearance-none cursor-pointer hover:border-blue-400 focus:outline-none">
                <div className="flex flex-col items-center space-y-2">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {contractFileName || 'Click to upload employment contract (PDF)'}
                  </span>
                </div>
                <input
                  id="contract"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleContractChange}
                />
              </label>
            </div>
            {contractFileName && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <File className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-900 max-w-[200px] truncate">{contractFileName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearContract}
                  className="h-6 w-6 p-0 hover:bg-blue-100"
                >
                  <X className="w-4 h-4 text-blue-600" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Certificates */}
        <div className="space-y-2">
          <Label htmlFor="certificates" className="text-sm font-medium">
            Certificates (PDF, JPG, PNG)
          </Label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-lg appearance-none cursor-pointer hover:border-blue-400 focus:outline-none">
                <div className="flex flex-col items-center space-y-2">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {certificateFileName || 'Click to upload certificates'}
                  </span>
                </div>
                <input
                  id="certificates"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleCertificateChange}
                />
              </label>
            </div>
            {certificateFileName && (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                <File className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-900 max-w-[200px] truncate">{certificateFileName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCertificate}
                  className="h-6 w-6 p-0 hover:bg-green-100"
                >
                  <X className="w-4 h-4 text-green-600" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Job Description */}
        <div className="space-y-2">
          <Label htmlFor="job_description" className="text-sm font-medium">
            Job Description
          </Label>
          <textarea
            id="job_description"
            className="w-full min-h-[100px] px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.job_description || ''}
            onChange={(e) => handleInputChange('job_description', e.target.value)}
            placeholder="Enter job description and responsibilities"
          />
        </div>
      </div>
    </div>
  );
};


