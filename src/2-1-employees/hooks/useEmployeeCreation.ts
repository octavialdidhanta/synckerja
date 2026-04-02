
import { useState } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { EmployeeFormData, CreateEmployeeResult } from '../types/forms';
import { useToast } from '@/shared/hooks/use-toast';
import { getCurrentOrganizationId } from '@/shared/auth/hooks/useCurrentOrg';
import { buildEmployeeData } from '../add-employee/useEmployeeDataBuilder';
import { useUserCreation } from './useUserCreation';
import { useMagicLinkCreation } from './useMagicLinkCreation';
import { useDataCleanup } from './useDataCleanup';
import { fetchCanAddEmployee } from "@/10-subscription/hooks/useOptimizedSubscription";
import { useEmployeeDocuments } from './useEmployeeDocuments';
import { useQueryClient } from '@tanstack/react-query';
// import { optimizedQueryKeys } from '@/utils/optimizedQueryClient';

export const useEmployeeCreation = () => {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { createUser } = useUserCreation();
  const { createMagicLink } = useMagicLinkCreation();
  const { cleanupUserData } = useDataCleanup();
  const { addDocument } = useEmployeeDocuments('');

  const createEmployee = async (formData: EmployeeFormData): Promise<CreateEmployeeResult | null> => {
    setIsCreating(true);
    let userId: string | null = null;
    let userCreated = false;
    let userOrganizationCreated = false;
    let organizationId: string;

    try {
      // Get org/user IDs
      try {
        const orgResult = await getCurrentOrganizationId();
        organizationId = orgResult.organizationId;
        // console.log('Creating employee for organization:', organizationId);
      } catch (e) {
        toast({
          title: "Error",
          description: "Anda belum memiliki organisasi. Silakan buat organisasi terlebih dahulu.",
          variant: "destructive",
        });
        return null;
      }

      // Check employee limit before proceeding
      const canAdd = await fetchCanAddEmployee(organizationId);
      if (!canAdd) {
        toast({
          title: "Employee Limit Exceeded",
          description: "You have reached the maximum number of employees for your current plan. Please upgrade your plan or reduce the number of employees.",
          variant: "destructive",
        });
        return null;
      }

      // Check if user already exists with this email
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, active_organization_id')
        .eq('email', formData.email)
        .maybeSingle();

      if (profileError) {
        console.error('Error checking existing profile:', profileError);
        toast({
          title: "Error",
          description: `Error checking user: ${profileError.message}`,
          variant: "destructive",
        });
        return null;
      }

      if (existingProfile) {
        // User already exists, use existing user ID
        userId = existingProfile.user_id;
        // console.log('Using existing user:', userId);

        // Check if user is already in this organization using service role
        const { data: existingUserOrg, error: userOrgError } = await supabase
          .from('user_organizations')
          .select('*')
          .eq('user_id', userId)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (userOrgError) {
          console.error('Error checking user organization:', userOrgError);
        }

        if (!existingUserOrg) {
          // Create user organization relationship directly
          const { error: userOrgError } = await supabase
            .from('user_organizations')
            .insert({
              user_id: userId,
              organization_id: organizationId,
              is_active: true,
              joined_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (userOrgError) {
            console.error('Error adding user to organization:', userOrgError);
            toast({
              title: "Error",
              description: `Failed to add user to organization: ${userOrgError.message}`,
              variant: "destructive",
            });
            return null;
          }

          // Create user role
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: userId,
              organization_id: organizationId,
              role: (formData.role || 'employee') as 'owner' | 'admin' | 'employee' | 'hr',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (roleError) {
            console.error('Error assigning role:', roleError);
            // Continue anyway since user organization was created
          }

          userOrganizationCreated = true;
          // console.log('User added to organization directly');
        }

        // Update profile active organization info for existing users if missing
        if (!existingProfile.active_organization_id) {
          // console.log('Updating existing user profile with active organization data...');
          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({ 
              active_organization_id: organizationId,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

          if (profileUpdateError) {
            console.error('Profile update error:', profileUpdateError);
            toast({
              title: "Warning",
              description: "Failed to update existing user profile with organization data.",
              variant: "default",
            });
          }
        }

        // Assign role for existing user using edge function if needed
        if (formData.role) {
          // console.log('Role assignment handled by edge function for existing user');
        }
      } else {
        // Create new user with role assignment directly in edge function
        console.log('ðŸ”„ Creating new user for:', formData.email);
        const createdUserId = await createUser(formData.email, formData.name, organizationId, formData.role);
        console.log('ðŸ“ createUser returned:', createdUserId);
        
        if (!createdUserId) {
          console.log('âŒ createUser returned null, returning null');
          return null;
        }
        userId = createdUserId;
        userCreated = true;
        userOrganizationCreated = true; // edge function handles this
        console.log('âœ… User created successfully with organization data and role:', userId);

        // Wait for user data to sync
        console.log('â³ Waiting for user data synchronization...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Increased wait time
      }

      // Build employee data with explicit organization_id and user_id
      const employeeData = await buildEmployeeData(formData, organizationId, userId); 
      
      // Ensure organization_id and user_id are set correctly
      employeeData.organization_id = organizationId;
      if (userId) {
        employeeData.user_id = userId;
      }
      
      // console.log('Employee data prepared with organization_id and user_id:', employeeData);

      // Check if employee already exists in this organization by email
      const { data: existingEmployee, error: checkError } = await supabase
        .from("employees")
        .select('id')
        .eq('email', formData.email)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing employee:', checkError);
      }

      if (existingEmployee) {
        toast({
          title: "Employee Already Exists",
          description: "An employee with this email already exists in this organization.",
          variant: "destructive",
        });
        return null;
      }

      // Check if NIK already exists in the database (across all organizations)
      if (formData.nik) {
        const { data: existingNikEmployee, error: nikCheckError } = await supabase
          .from("employees")
          .select('id, full_name, organization_id')
          .eq('nik', formData.nik)
          .maybeSingle();

        if (nikCheckError) {
          console.error('Error checking existing NIK:', nikCheckError);
        }

        if (existingNikEmployee) {
          toast({
            title: "NIK Already Exists",
            description: `NIK ${formData.nik} is already registered to employee ${existingNikEmployee.full_name}. Each NIK can only be used once.`,
            variant: "destructive",
          });
          return null;
        }
      }

      // Insert employee record with user_id from created auth user
      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .insert(employeeData)
        .select()
        .single();

      if (employeeError) {
        console.error('Employee upsert error:', employeeError);
        toast({
          title: "Error",
          description: `Failed to create/update employee record: ${employeeError.message}`,
          variant: "destructive",
        });
        return null;
      }

      // console.log('Employee record created/updated:', employee);

      // Save employee documents to the employee_documents table AND company_files table
      if (employee.id) {
        // console.log('Saving employee documents to database...');
        // TODO: Implement document saving logic using addDocument
        // await addDocument.mutateAsync(documentData);
      }

      // CREATE AND SEND SIGNUP INVITATION IMMEDIATELY
      console.log('Creating signup invitation for email:', formData.email);
      let magicLinkResult = null;
      
      // Always create magic link for both new and existing users
      magicLinkResult = await createMagicLink(userId, formData.email, formData.name, organizationId);
      
      let magicLinkSent = false;
      let emailError = null;

      if (magicLinkResult?.success) {
        if (magicLinkResult.emailSent) {
          magicLinkSent = true;
          // console.log('Signup invitation email sent successfully');
          toast({
            title: "Success",
            description: `Employee created successfully! Signup invitation has been sent to ${formData.email}`,
          });
        } else {
          emailError = magicLinkResult.emailError;
          console.warn('Signup invitation created but email failed to send:', emailError);
          toast({
            title: "Partial Success",
            description: `Employee created successfully, but invitation email failed to send. Please send the invitation manually.`,
            variant: "default",
          });
        }
      } else {
        emailError = magicLinkResult?.emailError || 'Unknown error';
        console.error('Failed to create signup invitation:', emailError);
        toast({
          title: "Partial Success",
          description: `Employee created successfully, but signup invitation creation failed. Please create access manually.`,
          variant: "default",
        });
      }

      // PERBAIKAN: Invalidate employee queries untuk auto refresh
      // console.log('ðŸ”„ Employee created successfully, invalidating queries for auto refresh...');
      queryClient.invalidateQueries({ queryKey: ['employees-optimized'] });
      queryClient.invalidateQueries({ queryKey: ['employees-optimized', organizationId] });
      
      // Also invalidate optimized query keys if available
      // if (optimizedQueryKeys?.employees?.all) {
      //   queryClient.invalidateQueries({
      //     queryKey: optimizedQueryKeys.employees.all
      //   });
      // }
      
      // console.log('âœ… Employee queries invalidated successfully');

      // Run cleanup in background
      // cleanupUserData(userId)
      //   .then(cleanupSuccess => {
      //     if (!cleanupSuccess) {
      //       console.warn('Background: Data cleanup failed, but employee was created');
      //     }
      //   })
      //   .catch(error => {
      //     console.error('Background: Data cleanup error:', error);
      //   });

      // Create result to return
      const result: CreateEmployeeResult = {
        success: true,
        employee_id: employee?.id || '',
        employee_number: employee?.employee_id || '',
        profile_id: userId || '',
        email: formData.email,
        magic_link_sent: magicLinkSent
      };

      return result;

    } catch (error: any) {
      console.error('Employee creation error:', error);
      
      // Enhanced rollback logic only for newly created users
      if (userId && userCreated && organizationId) {
        // console.log('Attempting to rollback changes for newly created user...');
        
        try {
          // Rollback user organization membership if we created it
          if (userOrganizationCreated) {
            await supabase.from('user_organizations').delete().eq('user_id', userId).eq('organization_id', organizationId);
            // console.log('User organization membership rolled back');
          }

          // Rollback user roles
          await supabase.from('user_roles').delete().eq('user_id', userId).eq('organization_id', organizationId);
          // console.log('User roles rolled back');

          // Reset profile organization info for new users
          await supabase
            .from('profiles')
            .update({ 
              active_organization_id: null 
            })
            .eq('user_id', userId);
          // console.log('Profile organization info reset');

        } catch (rollbackError) {
          console.error('Failed to rollback changes:', rollbackError);
        }
      }

      // Provide specific error message for duplicate constraint
      if (error?.message?.includes('duplicate key value violates unique constraint')) {
        toast({
          title: "Employee Already Exists",
          description: "An employee record already exists for this user in this organization. Please try updating the existing record instead.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error?.message || "An unexpected error occurred during employee creation",
          variant: "destructive",
        });
      }
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createEmployee,
    isCreating
  };
};

