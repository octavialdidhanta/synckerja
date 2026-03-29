import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Button } from '@/shared/components/ui/button';
import { BenefitsManager } from './BenefitsManager';
import { JobOpeningBasicInfoTab } from './JobOpeningBasicInfoTab';
import { JobOpeningDetailsTab } from './JobOpeningDetailsTab';
import { JobOpening, JobOpeningFormData, JobBenefit } from '../hooks/jobOpeningTypes';
import { 
  useDepartmentsCrud,
  useJobPositionsCrud,
  useJobLevelsCrud,
  useEmployeeStatusesCrud
} from '@/2-1-employees/MyInfo/Employment/hooks/crudMaster';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

interface JobOpeningModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: JobOpeningFormData) => Promise<void>;
  editData?: JobOpening | null;
  saving: boolean;
}

export const JobOpeningModal = ({ open, onClose, onSave, editData, saving }: JobOpeningModalProps) => {
  const { organizationId } = useCurrentOrg();
  const { data: departments } = useDepartmentsCrud(organizationId || undefined);
  const { data: jobLevels } = useJobLevelsCrud(organizationId || undefined);
  const { data: employeeStatuses } = useEmployeeStatusesCrud(organizationId || undefined);
  
  const [activeTab, setActiveTab] = useState('basic');
  
  const [formData, setFormData] = useState<JobOpeningFormData>({
    job_title: '',
    department_id: '',
    job_position_id: '',
    job_level_id: '',
    employment_status_id: '',
    location: '',
    salary_min: undefined,
    salary_max: undefined,
    job_description: '',
    requirements: '',
    responsibilities: '',
    benefits: [],
    status: 'draft',
    closing_date: undefined
  });

  // Fetch all job positions for the organization (without department filter)
  // We'll filter client-side to show department positions + global positions
  const { data: allJobPositions, isLoading: isLoadingPositions } = useJobPositionsCrud(
    organizationId || undefined
  );

  // Filter job positions: show positions for selected department + global positions (no department_id)
  const filteredJobPositions = useMemo(() => {
    if (!allJobPositions || allJobPositions.length === 0) {
      return [];
    }
    
    if (!formData.department_id) {
      return [];
    }
    
    // Show positions for selected department + global positions (no department_id)
    return allJobPositions.filter(position => 
      position.department_id === formData.department_id || !position.department_id
    );
  }, [allJobPositions, formData.department_id]);

  // Debug logging
  useEffect(() => {
    if (formData.department_id) {
      console.log('🔍 Job Positions Debug:', {
        departmentId: formData.department_id,
        allJobPositionsCount: allJobPositions?.length || 0,
        filteredJobPositionsCount: filteredJobPositions.length,
        filteredJobPositions: filteredJobPositions,
        isLoading: isLoadingPositions,
        allJobPositions: allJobPositions?.slice(0, 5).map(p => ({ 
          id: p.id, 
          name: p.name, 
          department_id: p.department_id 
        }))
      });
    }
  }, [formData.department_id, filteredJobPositions, isLoadingPositions, allJobPositions]);

  // Validation functions for each tab
  const isBasicInfoValid = () => {
    return formData.job_title.trim() !== '' && formData.department_id !== '';
  };

  const isDetailsValid = () => {
    return formData.job_description.trim() !== '' && formData.requirements.trim() !== '' && formData.responsibilities.trim() !== '';
  };

  const canProceedToNext = (currentTab: string) => {
    switch (currentTab) {
      case 'basic':
        return isBasicInfoValid();
      case 'details':
        return isDetailsValid();
      default:
        return true;
    }
  };

  const handleNextTab = () => {
    if (activeTab === 'basic' && canProceedToNext('basic')) {
      setActiveTab('details');
    } else if (activeTab === 'details' && canProceedToNext('details')) {
      setActiveTab('benefits');
    }
  };

  const handlePreviousTab = () => {
    if (activeTab === 'benefits') {
      setActiveTab('details');
    } else if (activeTab === 'details') {
      setActiveTab('basic');
    }
  };

  useEffect(() => {
    if (editData) {
      setFormData({
        job_title: editData.job_title,
        department_id: editData.department_id || '',
        job_position_id: editData.job_position_id || '',
        job_level_id: editData.job_level_id || '',
        employment_status_id: editData.employment_status_id || '',
        location: editData.location || '',
        salary_min: editData.salary_min,
        salary_max: editData.salary_max,
        job_description: editData.job_description || '',
        requirements: editData.requirements || '',
        responsibilities: editData.responsibilities || '',
        benefits: editData.benefits || [],
        status: editData.status,
        closing_date: editData.closing_date ? editData.closing_date.split('T')[0] : undefined
      });
    } else {
      // Reset form for new job opening
      setFormData({
        job_title: '',
        department_id: '',
        job_position_id: '',
        job_level_id: '',
        employment_status_id: '',
        location: '',
        salary_min: undefined,
        salary_max: undefined,
        job_description: '',
        requirements: '',
        responsibilities: '',
        benefits: [],
        status: 'draft',
        closing_date: undefined
      });
    }
    setActiveTab('basic');
  }, [editData, open]);

  const handleInputChange = (field: keyof JobOpeningFormData, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Reset job position when department changes
      if (field === 'department_id') {
        newData.job_position_id = '';
      }
      
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const handleClose = () => {
    onClose();
    setActiveTab('basic');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[700px] h-[700px] max-w-[700px] max-h-[700px] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {editData ? 'Edit Job Opening' : 'Create New Job Opening'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="details" disabled={!isBasicInfoValid()}>Job Details</TabsTrigger>
            <TabsTrigger value="benefits" disabled={!isBasicInfoValid() || !isDetailsValid()}>Benefits</TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <TabsContent value="basic" className="mt-4">
                <JobOpeningBasicInfoTab
                  formData={formData}
                  onInputChange={handleInputChange}
                  departments={departments}
                  jobPositions={filteredJobPositions}
                  jobLevels={jobLevels}
                  employeeStatuses={employeeStatuses}
                />
              </TabsContent>

              <TabsContent value="details" className="mt-4">
                <JobOpeningDetailsTab
                  formData={formData}
                  onInputChange={handleInputChange}
                />
              </TabsContent>

              <TabsContent value="benefits" className="mt-4">
                <BenefitsManager
                  benefits={formData.benefits || []}
                  onChange={(benefits: JobBenefit[]) => handleInputChange('benefits', benefits)}
                />
              </TabsContent>
            </div>

            <div className="flex-shrink-0 border-t pt-4">
              <div className="flex justify-between">
                <div className="flex gap-2">
                  {activeTab !== 'basic' && (
                    <Button type="button" variant="outline" onClick={handlePreviousTab}>
                      Previous
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  {activeTab !== 'benefits' && (
                    <Button
                      type="button"
                      onClick={handleNextTab}
                      disabled={!canProceedToNext(activeTab)}
                    >
                      Next
                    </Button>
                  )}
                  {activeTab === 'benefits' && (
                    <Button type="submit" disabled={saving || !isBasicInfoValid() || !isDetailsValid()}>
                      {saving ? 'Saving...' : editData ? 'Update' : 'Create'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
