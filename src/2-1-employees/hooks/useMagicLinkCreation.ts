import { supabase } from '@/shared/lib/supabaseClient';
import { useShowToast } from './useShowToast';

export const useMagicLinkCreation = () => {
  const showToast = useShowToast();

  const createMagicLink = async (
    userId: string, 
    email: string, 
    fullName: string, 
    organizationId?: string
  ): Promise<{ success: boolean; token?: string; magicLinkUrl?: string; emailSent?: boolean; emailError?: string | null } | null> => {
    try {
      console.log('Creating magic link for user:', { userId, email, fullName, organizationId });

      if (!userId || !email || !fullName || !organizationId) {
        console.error('Missing required parameters for magic link creation');
        return {
          success: false,
          emailSent: false,
          emailError: 'Missing required parameters'
        };
      }

      // Call the generate-magic-link edge function with increased timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Magic link generation timeout - please try again')), 15000) // 15 second timeout
      );

      const magicLinkPromise = supabase.functions.invoke('generate-magic-link', {
        body: {
          userId,
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          organizationId
        }
      });

      console.log('Calling generate-magic-link edge function...');
      const { data: magicLinkData, error: magicLinkError } = await Promise.race([
        magicLinkPromise,
        timeoutPromise
      ]) as any;

      if (magicLinkError) {
        console.error('Magic link generation error:', magicLinkError);
        return {
          success: false,
          emailSent: false,
          emailError: magicLinkError.message || 'Magic link generation failed'
        };
      }

      if (!magicLinkData) {
        console.error('No data returned from magic link generation');
        return {
          success: false,
          emailSent: false,
          emailError: 'No response from magic link service'
        };
      }

      if (!magicLinkData.success) {
        console.error('Magic link generation failed:', magicLinkData);
        return {
          success: false,
          emailSent: false,
          emailError: magicLinkData.error || 'Magic link generation failed'
        };
      }

      console.log('Magic link generated successfully:', {
        token: magicLinkData.token ? 'present' : 'missing',
        magicLinkUrl: magicLinkData.magicLinkUrl ? 'present' : 'missing',
        emailError: magicLinkData.emailError
      });

      const emailSent = !magicLinkData.emailError;
      
      if (emailSent) {
        console.log('Magic link email sent successfully to:', email);
      } else {
        console.warn('Magic link created but email failed:', magicLinkData.emailError);
      }

      return {
        success: true,
        token: magicLinkData.token,
        magicLinkUrl: magicLinkData.magicLinkUrl,
        emailSent: emailSent,
        emailError: magicLinkData.emailError
      };

    } catch (error: any) {
      console.error('Magic link creation failed:', error);
      
      let errorMessage = 'Failed to create magic link';
      if (error.message) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Magic link creation timed out - please try again';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error - please check your connection and try again';
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        success: false,
        emailSent: false,
        emailError: errorMessage
      };
    }
  };

  return {
    createMagicLink
  };
};