import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { XENDIT_CONNECT_PATH } from "@/xendit/lib/xenditPaths";

export function XenditSubAccountEmptyState() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
      <p className="text-sm text-muted-foreground">
        {t(
          "xendit.subAccountNotCreated",
          "No account yet. Register a new business on the Connect tab to register your drawer with Xendit.",
        )}
      </p>
      <Button asChild variant="outline" size="sm">
        <Link to={XENDIT_CONNECT_PATH}>
          {t("xendit.tabs.connect", "Connect account")}
        </Link>
      </Button>
    </div>
  );
}
