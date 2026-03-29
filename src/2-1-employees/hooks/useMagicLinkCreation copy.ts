
import { supabase } from '@/shared/lib/supabaseClient';

export const useMagicLinkCreation = () => {

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

      // For now, simulate successful magic link creation
      // In production, this should call actual email service
      const magicLinkUrl = `${window.location.origin}/auth/signup?token=${userId}&email=${encodeURIComponent(email)}`;
      const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('✅ Magic link generated:', magicLinkUrl);
      console.log('📧 Email invitation would be sent to:', email);
      
      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        token: token,
        magicLinkUrl: magicLinkUrl,
        emailSent: true,
        emailError: null
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
