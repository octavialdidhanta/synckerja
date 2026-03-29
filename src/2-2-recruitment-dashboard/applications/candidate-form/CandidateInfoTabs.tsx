
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { PersonalDetailsTab } from './PersonalDetailsTab';
import { AddressApplicationTab } from './AddressApplicationTab';
import { WorkExperienceTab } from './WorkExperienceTab';
import { EducationTab } from './EducationTab';
import { InformalEducationTab } from './InformalEducationTab';
import { FamilyMembersTab } from './FamilyMembersTab';
import { DocumentsTab } from './DocumentsTab';
import { CandidateReviewsTab } from './CandidateReviewsTab';
import { Button } from '@/shared/components/ui/button';
import { Edit, Save, X } from 'lucide-react';

interface CandidateInfoTabsProps {
  formData: any;
  onChange: (field: string, value: string) => void;
  departments: any[];
  jobPositions: any[];
  jobLevels: any[];
  branches: any[];
  employeeStatuses: any[];
  candidateProfileId?: string;
  cvFilePath?: string;
  candidateName?: string;
  isEditing?: boolean;
  onEditToggle?: (editing: boolean) => void;
  onSave?: () => void;
  saving?: boolean;
}

export const CandidateInfoTabs = ({
  formData,
  onChange,
  departments,
  jobPositions,
  jobLevels,
  branches,
  employeeStatuses,
  candidateProfileId,
  cvFilePath,
  candidateName,
  isEditing = false,
  onEditToggle,
  onSave,
  saving = false
}: CandidateInfoTabsProps) => {
  const [activeTab, setActiveTab] = useState('personal');

  // Convert formData to candidate format for the new tab components
  const candidate = {
    id: candidateProfileId,
    full_name: formData.applicantName || '',
    email: formData.applicantEmail || '',
    mobile_phone: formData.applicantPhone || '',
    birth_date: formData.birth_date || '',
    birth_place: formData.birth_place || '',
    gender: formData.gender || '',
    nik: formData.nik || '',
    religion: formData.religion || '',
    marital_status: formData.marital_status || '',
    nationality: formData.nationality || '',
    blood_type: formData.blood_type || '',
    address: formData.address || '',
    citizen_address: formData.citizen_address || '',
    postal_code: formData.postal_code || '',
    photo_url: formData.photo_url || ''
  };

  // Convert onChange to onUpdate format
  const handleUpdate = async (updatedData: any) => {
    Object.keys(updatedData).forEach(key => {
      let formKey = key;
      // Map candidate field names to form field names
      if (key === 'full_name') formKey = 'applicantName';
      if (key === 'mobile_phone') formKey = 'applicantPhone';
      
      onChange(formKey, updatedData[key]);
    });
    
    // Trigger save if onSave is provided
    if (onSave) {
      await onSave();
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="border-b bg-white px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <TabsList className="grid grid-cols-8 w-auto">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="address">Address</TabsTrigger>
              <TabsTrigger value="education">Education</TabsTrigger>
              <TabsTrigger value="informal-education">Informal Education</TabsTrigger>
              <TabsTrigger value="work">Work</TabsTrigger>
              <TabsTrigger value="family">Family</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="personal" className="h-full overflow-y-auto p-6 m-0">
            <PersonalDetailsTab
              candidate={candidate}
              onUpdate={handleUpdate}
              isReadOnly={false}
            />
          </TabsContent>

          <TabsContent value="address" className="h-full overflow-y-auto p-6 m-0">
            <AddressApplicationTab 
              candidate={candidate}
              onUpdate={handleUpdate}
              isReadOnly={false}
            />
          </TabsContent>

          <TabsContent value="education" className="h-full overflow-y-auto p-6 m-0">
            <EducationTab candidateProfileId={candidateProfileId} />
          </TabsContent>

          <TabsContent value="informal-education" className="h-full overflow-y-auto p-6 m-0">
            <InformalEducationTab candidateProfileId={candidateProfileId} />
          </TabsContent>

          <TabsContent value="work" className="h-full overflow-y-auto p-6 m-0">
            <WorkExperienceTab candidateProfileId={candidateProfileId} />
          </TabsContent>

          <TabsContent value="family" className="h-full overflow-y-auto p-6 m-0">
            <FamilyMembersTab candidateProfileId={candidateProfileId} />
          </TabsContent>

          <TabsContent value="documents" className="h-full m-0">
            <DocumentsTab candidateProfileId={candidateProfileId} />
          </TabsContent>

          <TabsContent value="reviews" className="h-full overflow-hidden m-0">
            <div className="h-full p-6">
              <CandidateReviewsTab 
                candidateProfileId={candidateProfileId} 
                cvFilePath={cvFilePath}
                candidateName={candidateName}
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
