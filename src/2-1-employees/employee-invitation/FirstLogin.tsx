
import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SetPasswordForm } from "./SetPasswordForm";
import { useMagicLinkValidation } from "./useMagicLinkValidation";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";

export default function FirstLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [validationData, setValidationData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { validateMagicLink, loading } = useMagicLinkValidation();
  const hasValidatedRef = useRef(false); // Prevent multiple validations

  useEffect(() => {
    // Prevent multiple executions
    if (hasValidatedRef.current) {
      return;
    }

    const token = searchParams.get('token');
    const isMagicLink = searchParams.get('magic_link') === 'true';

    if (!token || !isMagicLink) {
      setError('Link tidak valid. Token atau parameter magic_link tidak ditemukan.');
      return;
    }

    hasValidatedRef.current = true;

    const validateToken = async () => {
      console.log('🔍 FirstLogin: Validating token:', token.substring(0, 20) + '...');
      
      const result = await validateMagicLink(token);
      
      if (result && result.valid) {
        console.log('✅ FirstLogin: Token valid, setting validation data');
        setValidationData({
          token,
          email: result.email,
          fullName: result.fullName,
          organizationId: result.organizationId
        });
      } else {
        console.log('❌ FirstLogin: Token validation failed');
        setError(result?.error || 'Token tidak valid atau sudah kedaluwarsa');
      }
    };

    validateToken();
  }, [searchParams, validateMagicLink]); // Only depend on searchParams and validateMagicLink

  const handleSuccess = () => {
    console.log('✅ FirstLogin: Password setup successful, redirecting to login');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Card className="w-full max-w-md shadow border rounded-2xl bg-white">
          <CardContent className="flex items-center justify-center p-8">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-lg text-gray-600">Memvalidasi undangan...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Card className="w-full max-w-md shadow border rounded-2xl bg-white">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Link Tidak Valid
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full h-12 text-base font-semibold bg-[#181E29] hover:bg-[#222b3c] text-white rounded-lg transition-colors"
            >
              Kembali ke Login
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!validationData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Card className="w-full max-w-md shadow border rounded-2xl bg-white">
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-gray-600">Memproses undangan...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SetPasswordForm
      token={validationData.token}
      email={validationData.email}
      fullName={validationData.fullName}
      organizationId={validationData.organizationId}
      onSuccess={handleSuccess}
    />
  );
}

