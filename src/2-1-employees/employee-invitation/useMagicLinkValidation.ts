
import { useState, useCallback } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { toast } from "@/shared/components/ui/use-toast";

interface MagicLinkValidationResult {
  valid: boolean;
  email: string;
  fullName: string;
  organizationId?: string;
  error?: string;
}

export const useMagicLinkValidation = () => {
  const [loading, setLoading] = useState(false);

  const validateMagicLink = useCallback(async (token: string): Promise<MagicLinkValidationResult | null> => {
    if (!token) {
      return {
        valid: false,
        email: '',
        fullName: '',
        error: 'Token tidak valid'
      };
    }

    setLoading(true);
    
    try {
      console.log('🔍 useMagicLinkValidation: Validating token:', token.substring(0, 20) + '...');
      
      // Call edge function instead of direct admin API call
      const { data, error } = await supabase.functions.invoke('validate-magic-link', {
        body: { token }
      });

      console.log('✅ useMagicLinkValidation: Edge function response:', data);

      if (error) {
        console.error('❌ useMagicLinkValidation: Edge function error:', error);
        return {
          valid: false,
          email: '',
          fullName: '',
          error: 'Terjadi kesalahan saat memvalidasi undangan'
        };
      }

      if (!data || !data.valid) {
        console.log('❌ useMagicLinkValidation: Invalid response from edge function');
        return {
          valid: false,
          email: '',
          fullName: '',
          error: data?.error || 'Magic link tidak valid atau sudah kedaluwarsa'
        };
      }

      console.log('✅ useMagicLinkValidation: Validation successful', {
        email: data.email,
        fullName: data.fullName,
        organizationId: data.organizationId
      });

      return {
        valid: true,
        email: data.email || '',
        fullName: data.fullName || '',
        organizationId: data.organizationId,
      };

    } catch (error) {
      console.error('💥 useMagicLinkValidation: Error validating magic link:', error);
      return {
        valid: false,
        email: '',
        fullName: '',
        error: 'Terjadi kesalahan saat memvalidasi undangan'
      };
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array since the function doesn't depend on any external values

  return { validateMagicLink, loading };
};
