
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Textarea } from '@/shared/components/ui/textarea';
import { useCompanyProfile } from '../hooks';

interface CompanyMissionVisionProps {
  formData?: any;
  isEditMode?: boolean;
  onFieldChange?: (field: string, value: string) => void;
}

export const CompanyMissionVision = ({ 
  formData: propFormData,
  isEditMode = false,
  onFieldChange
}: CompanyMissionVisionProps) => {
  const { data: companyData } = useCompanyProfile();
  
  // Use prop formData if provided, otherwise use companyData
  const formData = propFormData || {
    about_us: companyData?.about_us || '',
    mission: companyData?.mission || '',
    vision: companyData?.vision || '',
  };

  const handleInputChange = (field: 'about_us' | 'mission' | 'vision', value: string) => {
    if (onFieldChange) {
      onFieldChange(field, value);
    }
  };

  const currentAboutUs = isEditMode ? (formData.about_us || '') : (companyData?.about_us || '');
  const currentMission = isEditMode ? (formData.mission || '') : (companyData?.mission || '');
  const currentVision = isEditMode ? (formData.vision || '') : (companyData?.vision || '');

  return (
    <div className="space-y-2 sm:space-y-3 min-w-0">
      {/* About Us Section */}
      <Card className="min-w-0">
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-base sm:text-lg font-semibold">About Us</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isEditMode ? (
            <Textarea
              value={formData.about_us}
              onChange={(e) => handleInputChange('about_us', e.target.value)}
              rows={4}
              className="text-xs sm:text-sm resize-none"
              placeholder="Enter about us information"
            />
          ) : (
            <p className="text-foreground/90 leading-relaxed text-xs sm:text-sm break-words">
              {currentAboutUs || 'No about us information defined.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Mission & Vision */}
      <Card className="min-w-0">
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-base sm:text-lg font-semibold">Mission & Vision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 pt-0">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-medium text-foreground mb-1 sm:mb-2">Mission</h3>
            {isEditMode ? (
              <Textarea
                value={formData.mission}
                onChange={(e) => handleInputChange('mission', e.target.value)}
                rows={3}
                className="text-xs sm:text-sm resize-none"
                placeholder="Enter mission statement"
              />
            ) : (
              <p className="text-foreground/90 leading-relaxed text-xs sm:text-sm break-words">
                {currentMission || 'No mission statement defined.'}
              </p>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-medium text-foreground mb-1 sm:mb-2">Vision</h3>
            {isEditMode ? (
              <Textarea
                value={formData.vision}
                onChange={(e) => handleInputChange('vision', e.target.value)}
                rows={3}
                className="text-xs sm:text-sm resize-none"
                placeholder="Enter vision statement"
              />
            ) : (
              <p className="text-foreground/90 leading-relaxed text-xs sm:text-sm break-words">
                {currentVision || 'No vision statement defined.'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
