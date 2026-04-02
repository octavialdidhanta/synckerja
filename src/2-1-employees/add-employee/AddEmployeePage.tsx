
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useActiveOrganization } from '@/10-subscription/shared/useActiveOrganization';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { CreateOrganizationModal } from '@/shared/layouts/header/CreateOrganizationModal';
import { AddEmployeePageSkeleton } from './AddEmployeePageSkeleton';
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
  const { organizationId: activeOrgId, loading: membershipsLoading } = useActiveOrganization();
  const { subscriptionStatus, statusLoading } = useOptimizedSubscription({ includePlans: false });

  /** Align with subscription org id; avoids form → spinner → form when user-organizations resolves after CurrentOrgContext. */
  const hardDataReady =
    !orgLoading &&
    !membershipsLoading &&
    (!organizationId || !activeOrgId || !statusLoading);
  const wantsForm = Boolean(organizationId) && Boolean(activeOrgId);
  const debouncedFormReady = useDebouncedReady(hardDataReady && wantsForm, 160);
  const showBootstrapShell = !hardDataReady || (wantsForm && !debouncedFormReady);

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
      const planLimit =
        subscriptionStatus.member_limit && subscriptionStatus.member_limit > 0
          ? subscriptionStatus.member_limit
          : subscriptionStatus.member_count;
      toast({
        title: "Employee Limit Reached",
        description: `You have reached your plan limit of ${planLimit ?? "your plan's"} employees. Please upgrade your plan to add more employees.`,
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

  if (showBootstrapShell) {
    return <AddEmployeePageSkeleton />;
  }

  if (!organizationId) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-gray-50">
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
    <EmployeeLimitHardGuard subscriptionStatus={subscriptionStatus} statusLoading={statusLoading}>
      <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-gray-50">
        {subscriptionStatus?.over_limit && (
          <SubscriptionWarningBanner
            subscriptionStatus={subscriptionStatus}
            className="mx-4 mt-4 shrink-0"
          />
        )}

        <main className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 pb-12 pt-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="container mx-auto max-w-4xl">
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



