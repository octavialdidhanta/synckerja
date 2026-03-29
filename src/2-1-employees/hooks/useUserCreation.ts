
import { supabase } from '@/shared/lib/supabaseClient';

export const useUserCreation = () => {

  const createUser = async (email: string, name: string, organizationId: string, role?: string) => {
    console.log('🚀 useUserCreation.createUser called with:', { email, name, organizationId, role });
    
    try {
      const normalizedEmail = email.trim().toLowerCase();
      
      // PRE-CHECK: Verify if user already exists in THIS organization
      console.log('🔍 Pre-checking if user already in organization...');
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', normalizedEmail)
        .maybeSingle();
      
      if (existingProfile) {
        console.log('📋 User exists, checking organization membership...');
        const { data: existingUserOrg } = await supabase
          .from('user_organizations')
          .select('id')
          .eq('user_id', existingProfile.user_id)
          .eq('organization_id', organizationId)
          .maybeSingle();
        
        if (existingUserOrg) {
          console.error('❌ User already in THIS organization');
          throw new Error('User sudah terdaftar di organisasi ini');
        }
        
        console.log('✅ User exists but NOT in this organization - proceeding...');
      }
      
      // Use edge function for user creation with admin privileges
      console.log('📝 Creating user via edge function...');
      const { data: createUserData, error: createUserError } = await supabase.functions.invoke('create-user', {
        body: {
          email: normalizedEmail,
          name: name.trim(),
          organizationId: organizationId,
          role: role || 'employee'
        }
      });

      // Check for HTTP/Network errors
      if (createUserError) {
        console.error('❌ Edge function HTTP error:', createUserError);
        console.log('📊 Response data:', createUserData);
        console.log('📊 Error type:', createUserError.constructor.name);
        console.log('📊 Error context:', (createUserError as any).context);
        
        // For FunctionsHttpError, the error body might be in context
        let errorMessage = 'Gagal membuat user. Silakan coba lagi.';
        
        // Try to extract error from various locations
        if (createUserData?.error) {
          // Error in data (if supabase client parsed it)
          errorMessage = createUserData.error;
          console.log('✅ Found error in response data:', errorMessage);
        } else if ((createUserError as any).context) {
          // Error might be in context for FunctionsHttpError
          const context = (createUserError as any).context;
          console.log('🔍 Error context object:', context);
          
          // If context is a Response object, parse it
          if (context instanceof Response) {
            console.log('📥 Context is Response object, parsing body...');
            try {
              const responseBody = await context.clone().json();
              console.log('📊 Parsed response body:', responseBody);
              
              if (responseBody && responseBody.error) {
                errorMessage = responseBody.error;
                console.log('✅ Found error in Response body:', errorMessage);
              }
            } catch (parseError) {
              console.error('Failed to parse Response body:', parseError);
              // Try to read as text if JSON parse fails
              try {
                const textBody = await context.clone().text();
                console.log('📄 Response as text:', textBody);
              } catch (e) {
                console.error('Could not read response at all');
              }
            }
          } else if (typeof context === 'string') {
            try {
              const parsed = JSON.parse(context);
              if (parsed.error) {
                errorMessage = parsed.error;
                console.log('✅ Parsed error from context string:', errorMessage);
              }
            } catch (e) {
              console.error('Failed to parse context as JSON');
            }
          } else if (context && typeof context === 'object' && context.error) {
            errorMessage = context.error;
            console.log('✅ Found error in context object:', errorMessage);
          }
        }
        
        console.error('❌ Final error message:', errorMessage);
        throw new Error(errorMessage);
      }

      // Check if edge function returned failure
      if (!createUserData?.success) {
        const errorMessage = createUserData?.error || 'Gagal membuat user';
        console.error('❌ Edge function returned failure:', {
          error: errorMessage,
          userExists: createUserData?.userExists,
          data: createUserData
        });
        throw new Error(errorMessage);
      }

      const userId = createUserData.userId;
      console.log('✅ User created/added successfully with ID:', userId);
      console.log('📊 Details:', {
        isNewUser: createUserData.isNewUser,
        userOrganization: createUserData.userOrganization,
        magicLink: createUserData.magicLink ? 'Created' : 'Not created'
      });
      
      return userId;
      
    } catch (err: any) {
      console.error('❌ User creation error:', err);
      // Re-throw with proper message so UI can show it
      throw new Error(err.message || 'Terjadi kesalahan saat membuat user');
    }
  };

  return { createUser };
};
