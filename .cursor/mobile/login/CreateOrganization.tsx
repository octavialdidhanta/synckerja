
import { Card, CardContent, CardHeader, CardTitle } from "@/features/ui/card";
import { Button } from "@/features/ui/button";
import OrganizationForm from "@/features/1-login/components/CreateOrganization/OrganizationForm";
import { useNavigate } from "react-router-dom";
import { Building, ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useCentralizedUserData } from "@/features/1-login/contexts/CentralizedUserDataContext";

const CreateOrganization = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isEmailVerified, hasOrganization, loading } = useCentralizedUserData();
  const [formLoading, setFormLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Helper function untuk membaca sessionStorage flags
  const getSessionFlags = () => {
    if (typeof window === 'undefined') return { emailJustVerified: false, organizationJustCreated: false };
    return {
      emailJustVerified: sessionStorage.getItem('emailJustVerified') === 'true',
      organizationJustCreated: sessionStorage.getItem('organizationJustCreated') === 'true'
    };
  };

  useEffect(() => {
    // Wait for loading to complete
    if (loading) return;

    // Read session flags fresh on each effect run
    const sessionFlags = getSessionFlags();

    // IMPORTANT: Skip SEMUA checks jika organization baru saja dibuat
    // Ini mencegah redirect yang mengganggu flow dari OrganizationForm ke create-plan
    // Juga skip jika sedang di halaman create-plan (mencegah redirect loop)
    const currentPath = window.location.pathname;
    if (sessionFlags.organizationJustCreated || currentPath === '/create-plan') {
      console.log('CreateOrganization: Organization just created or on create-plan page, skipping all redirect checks');
      return;
    }

    // Redirect ke login jika tidak authenticated
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    
    // Redirect ke verify-email jika email belum verified (kecuali baru verified)
    if (!isEmailVerified && !sessionFlags.emailJustVerified) {
      navigate('/verify-email', { replace: true });
      return;
    }
    
    // Clear emailJustVerified flag setelah digunakan
    if (sessionFlags.emailJustVerified) {
      sessionStorage.removeItem('emailJustVerified');
    }
    
    // HAPUS redirect ke home - biarkan OrganizationForm handle redirect
    // Jika user sudah punya organization, mereka tidak akan sampai ke halaman ini
    // karena akan di-block di HomeAccessGuard atau routing level
  }, [isAuthenticated, isEmailVerified, loading, navigate]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="fixed left-0 right-0 top-0 modal-above-safe-area flex flex-col bg-[#f8fafc] overflow-hidden z-0">
        <div className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 safe-area-top px-4 pt-4 pb-3">
          <h1 className="text-lg font-semibold text-left">Buat Organisasi</h1>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-900 mb-1">Memuat Data...</h2>
            <p className="text-gray-600 text-sm">Mohon tunggu sebentar...</p>
          </div>
        </div>
      </div>
    );
  }

  // Mobile fullscreen layout: modal-above-safe-area agar footer di atas pita navigasi device
  return (
    <div className="fixed left-0 right-0 top-0 modal-above-safe-area flex flex-col bg-[#f8fafc] overflow-hidden z-0">
      {/* Header - sticky di atas (flex-shrink-0, tidak ikut scroll) */}
      <header className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate("/login")}
            className="p-1.5 h-8 w-8 -ml-1"
            aria-label="Kembali"
          >
            <ArrowLeft size={18} />
          </Button>
          <Building size={20} className="text-primary flex-shrink-0" />
          <h1 className="text-lg font-semibold leading-tight">
            Buat Organisasi Pertama
          </h1>
        </div>
      </header>

      {/* Body - satu-satunya area scroll; overscroll-contain agar tidak overscroll ke luar (footer/header tidak terangkat) */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain seamless-scroll touch-pan-y">
        <div className="px-4 py-4 pb-4">
          <OrganizationForm
            formId="create-org-form"
            hideSubmitButton
            onLoadingChange={setFormLoading}
            onAcceptTermsChange={setAcceptTerms}
          />
        </div>
      </div>

      {/* Footer - sticky di bawah (flex-shrink-0, tidak ikut scroll) */}
      <div className="flex-shrink-0 px-4 pt-3 pb-3 border-t bg-muted/30">
        <div className="flex items-center justify-end gap-2">
          <Button
            type="submit"
            form="create-org-form"
            size="sm"
            disabled={formLoading || !acceptTerms}
            className="min-w-[120px] flex items-center justify-center gap-1.5"
          >
            {formLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Membuat Organisasi...</span>
              </>
            ) : (
              "Buat Organisasi"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateOrganization;
