import { Building2, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabaseClient";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";

export default function OrganizationUnavailablePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clearOrganizationSession } = useCentralizedUserData();

  const handleSignOut = async () => {
    clearOrganizationSession();
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      /* ignore */
    }
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-6 safe-area-top safe-area-bottom-lower">
      <Card className="w-full max-w-lg border-border/80 shadow-md">
        <CardContent className="flex flex-col items-center gap-6 px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Building2 className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">
              {t("organizationUnavailable.title", "Organization unavailable")}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(
                "organizationUnavailable.description",
                "Your organization is no longer available. It may have been removed by an administrator. Please contact your Synckerja administrator or sign out and use another account.",
              )}
            </p>
          </div>

          <Button type="button" className="w-full max-w-xs" onClick={() => void handleSignOut()}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden />
            {t("organizationUnavailable.signOut", "Sign out")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
