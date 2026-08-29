import { Link } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_WELCOME_I18N } from "../lib/posWelcomeCopy";

export function PosWelcomeLegalFooter() {
  const { t } = useAppTranslation();

  return (
    <p className="mt-10 max-w-sm text-center text-xs italic text-muted-foreground">
      {t(POS_WELCOME_I18N.legalPrefix, "By registering you agree to the")}{" "}
      <Link
        to="/terms-and-conditions"
        className="font-medium not-italic text-primary hover:underline"
      >
        {t(POS_WELCOME_I18N.termsLink, "terms and conditions")}
      </Link>{" "}
      {t(POS_WELCOME_I18N.legalSuffix, "of Synckerja POS.")}
    </p>
  );
}
