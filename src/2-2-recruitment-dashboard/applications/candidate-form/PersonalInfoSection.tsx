
import { PersonalDetailsTab } from './PersonalDetailsTab';
import { AddressApplicationTab } from './AddressApplicationTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { User, MapPin } from 'lucide-react';

interface PersonalInfoData {
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  birth_date: string;
  gender: string;
  nik: string;
  religion: string;
  marital_status: string;
  nationality: string;
  blood_type: string;
  birth_place: string;
  address: string;
  citizen_address: string;
  postal_code: string;
  expectedSalary: string;
  experienceYears: string;
  coverLetter: string;
}

interface PersonalInfoSectionProps {
  formData: PersonalInfoData;
  onChange: (field: string, value: string) => void;
  departments?: Array<{ id: string; name: string }>;
  jobPositions?: Array<{ id: string; name: string }>;
  jobLevels?: Array<{ id: string; name: string }>;
  branches?: Array<{ id: string; name: string }>;
  employeeStatuses?: Array<{ id: string; name: string }>;
}

export function PersonalInfoSection({ 
  formData, 
  onChange,
  departments = [],
  jobPositions = [],
  jobLevels = [],
  branches = [],
  employeeStatuses = []
}: PersonalInfoSectionProps) {
  // Convert formData to candidate format for the new tab components
  const candidate = {
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
    postal_code: formData.postal_code || ''
  };

  // Convert onChange to onUpdate format
  const handleUpdate = (updatedData: any) => {
    Object.keys(updatedData).forEach(key => {
      let formKey = key;
      // Map candidate field names to form field names
      if (key === 'full_name') formKey = 'applicantName';
      if (key === 'mobile_phone') formKey = 'applicantPhone';
      
      onChange(formKey, updatedData[key]);
    });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="personal-details" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gray-100 rounded-lg p-1">
          <TabsTrigger 
            value="personal-details" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <User className="h-4 w-4" />
            Personal Details
          </TabsTrigger>
          <TabsTrigger 
            value="address-application" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <MapPin className="h-4 w-4" />
            Address & Application
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal-details" className="mt-6">
          <PersonalDetailsTab
            candidate={candidate}
            onUpdate={handleUpdate}
            isReadOnly={false}
          />
        </TabsContent>

        <TabsContent value="address-application" className="mt-6">
          <AddressApplicationTab
            candidate={candidate}
            onUpdate={handleUpdate}
            isReadOnly={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
