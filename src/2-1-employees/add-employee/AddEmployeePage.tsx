
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { CreateOrganizationModal } from '@/shared/layouts/header/CreateOrganizationModal';
import { useAddEmployeeForm } from '../hooks/useAddEmployeeForm';
import { useEmployeeValidation } from '../hooks/useEmployeeValidation';
import { useEmployeeCreation } from '../hooks/useEmployeeCreation';
import { useStepNavigation } from '../hooks/useStepNavigation';
import { PersonalInfoStep } from './PersonalInfoStep';
import { EmploymentInfoStep } from './EmploymentInfoStep';
import { InviteAccessStep } from './InviteAccessStep';
import { StepHeader } from './StepHeader';
import { StepNavigation } from './StepNavigation';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/hooks/use-toast';
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { EmployeeLimitHardGuard } from './EmployeeLimitHardGuard';
import { SubscriptionWarningBanner } from '@/shared/banners/SubscriptionWarningBanner';
const AddEmployee = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { subscriptionStatus, statusLoading } = useOptimizedSubscription();

  // Hide all scrollbars on this page
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .add-employee-page ::-webkit-scrollbar {
        display: none !important;
      }
      .add-employee-page {
        -ms-overflow-style: none !important;
        scrollbar-width: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  const {
    formData,
    isSubmitting,
    updateFormData,
    setSubmitting,
    resetForm
  } = useAddEmployeeForm();
  
  const {
    createEmployee
  } = useEmployeeCreation();
  
  const validationSchema = useEmployeeValidation(formData);
  
  const stepNavigation = useStepNavigation(validationSchema, formData);

  // Debug logging removed to prevent infinite re-renders

  const handleBack = () => {
    navigate('/employees');
  };

  const handleSave = async () => {
    // Check if at or over employee limit before proceeding
    if (subscriptionStatus?.over_limit) {
      toast({
        title: "Employee Limit Reached",
        description: `You have reached your plan limit of ${maxEmployees} employees. Please upgrade your plan to add more employees.`,
        variant: "destructive",
      });
      return;
    }

    if (!validationSchema.validatePersonalData() || 
        !validationSchema.validateEmploymentData() || 
        !validationSchema.validateInviteData()) {
      toast({
        title: "Validation Error",
        description: "Please complete all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!organizationId) {
      toast({
        title: "Organization Required",
        description: "No active organization found. Please select an organization first.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // console.log('Creating employee for organization:', organizationId);
      const result = await createEmployee(formData);
      if (result?.success) {
        // console.log('Employee created successfully:', result);
        toast({
          title: "Success!",
          description: `Employee ${formData.name} has been successfully added to the organization.`,
          variant: "default",
        });
        resetForm();
        navigate('/employees');
      }
    } catch (error) {
      console.error('Error saving employee:', error);
      toast({
        title: "Failed to Create Employee",
        description: "An error occurred while creating the employee. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (orgLoading || statusLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-6 max-w-md">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-2">Organisasi Diperlukan</h2>
            <p className="text-gray-600 mb-4">
              Anda perlu memiliki organisasi aktif untuk menambahkan karyawan.
            </p>
            <div className="space-y-2">
              <Button onClick={() => setShowCreateOrgModal(true)} className="w-full">
                Buat Organisasi Baru
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/')} 
                className="w-full"
              >
                Kembali ke Dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const renderStepContent = () => {
    switch (stepNavigation.activeTab) {
      case 'personal':
        return <PersonalInfoStep formData={formData} handleInputChange={updateFormData} />;
      case 'employment':
        return <EmploymentInfoStep formData={formData} handleInputChange={updateFormData} />;
      case 'invite':
        return <InviteAccessStep formData={formData} handleInputChange={updateFormData} />;
      default:
        return <PersonalInfoStep formData={formData} handleInputChange={updateFormData} />;
    }
  };

  return (
    <EmployeeLimitHardGuard feature="employee creation">
      <div className="min-h-0 flex-1 bg-gray-50 pb-12 add-employee-page">
        {/* Warning Banner - Show when at or over limit */}
        {subscriptionStatus?.over_limit && (
          <SubscriptionWarningBanner 
            subscriptionStatus={subscriptionStatus}
            className="mx-4 mt-4"
          />
        )}
        
        <main 
          className="container mx-auto px-4 py-6 max-h-screen overflow-y-auto"
        >
          <div className="max-w-4xl mx-auto">
            <Button variant="ghost" onClick={handleBack} className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Employees
            </Button>

            <Card className="shadow-sm border border-gray-200 mb-4">
              <CardContent className="p-6">
                <StepHeader
                  activeTab={stepNavigation.activeTab}
                  onTabChange={stepNavigation.setActiveTab}
                  isPersonalValid={validationSchema.validatePersonalData()}
                  isEmploymentValid={validationSchema.validateEmploymentData()}
                  isInviteValid={validationSchema.validateInviteData()}
                />
                
                <div className="mt-6">
                  {renderStepContent()}
                </div>

                <StepNavigation
                  activeTab={stepNavigation.activeTab}
                  canProceedPrev={stepNavigation.canProceedPrev}
                  canProceedNext={stepNavigation.canProceedNext}
                  onPrevStep={stepNavigation.handlePrevStep}
                  onNextStep={stepNavigation.handleNextStep}
                  onSave={handleSave}
                  isSubmitting={isSubmitting}
                />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <CreateOrganizationModal open={showCreateOrgModal} onOpenChange={setShowCreateOrgModal} />
    </EmployeeLimitHardGuard>
  );
};

export default AddEmployee;



