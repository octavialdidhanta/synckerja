
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Textarea } from '@/shared/components/ui/textarea';
import { useCompanyProfile } from '../hooks';

interface CompanyMissionVisionProps {
  formData?: any;
  isEditMode?: boolean;
  onFieldChange?: (field: string, value: string) => void;
  /** Which blocks to render. Default shows both. */
  sections?: Array<'about' | 'missionVision'>;
}

export const CompanyMissionVision = ({ 
  formData: propFormData,
  isEditMode = false,
  onFieldChange,
  sections = ['about', 'missionVision'],
}: CompanyMissionVisionProps) => {
  const { data: companyData } = useCompanyProfile();
  
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
  const showAbout = sections.includes('about');
  const showMissionVision = sections.includes('missionVision');

  return (
    <div className="min-w-0 space-y-2 sm:space-y-3">
      {showAbout ? (
        <Card className="min-w-0">
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-base font-semibold sm:text-lg">About Us</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isEditMode ? (
              <Textarea
                value={formData.about_us}
                onChange={(e) => handleInputChange('about_us', e.target.value)}
                rows={4}
                className="resize-none text-xs sm:text-sm"
                placeholder="Enter about us information"
              />
            ) : (
              <p className="break-words text-xs leading-relaxed text-foreground/90 sm:text-sm">
                {currentAboutUs || 'No about us information defined.'}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {showMissionVision ? (
        <Card className="min-w-0">
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-base font-semibold sm:text-lg">Mission & Vision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 sm:space-y-4">
            <div className="min-w-0">
              <h3 className="mb-1 text-sm font-medium text-foreground sm:mb-2 sm:text-base">Mission</h3>
              {isEditMode ? (
                <Textarea
                  value={formData.mission}
                  onChange={(e) => handleInputChange('mission', e.target.value)}
                  rows={3}
                  className="resize-none text-xs sm:text-sm"
                  placeholder="Enter mission statement"
                />
              ) : (
                <p className="break-words text-xs leading-relaxed text-foreground/90 sm:text-sm">
                  {currentMission || 'No mission statement defined.'}
                </p>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="mb-1 text-sm font-medium text-foreground sm:mb-2 sm:text-base">Vision</h3>
              {isEditMode ? (
                <Textarea
                  value={formData.vision}
                  onChange={(e) => handleInputChange('vision', e.target.value)}
                  rows={3}
                  className="resize-none text-xs sm:text-sm"
                  placeholder="Enter vision statement"
                />
              ) : (
                <p className="break-words text-xs leading-relaxed text-foreground/90 sm:text-sm">
                  {currentVision || 'No vision statement defined.'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
