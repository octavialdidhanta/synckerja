import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import { POS_WELCOME_I18N } from "../lib/posWelcomeCopy";

export function PosWelcomeActions() {
  const { t } = useAppTranslation();

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Button
        asChild
        className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Link to={POS_AUTH_PATHS.register} replace>
          {t(POS_WELCOME_I18N.titleCta, "Start Selling with Synckerja POS")}
        </Link>
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t(POS_WELCOME_I18N.alreadyHaveAccount, "Already have a Synckerja POS account?")}{" "}
        <Link
          to={POS_AUTH_PATHS.login}
          replace
          className="font-medium text-primary hover:underline"
        >
          {t(POS_WELCOME_I18N.signIn, "Sign in")}
        </Link>
      </p>
    </div>
  );
}
