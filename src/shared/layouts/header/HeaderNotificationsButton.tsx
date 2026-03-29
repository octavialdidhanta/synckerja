import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";

/**
 * Header notifications entry point. Wire badge count when a notifications API exists.
 */
export function HeaderNotificationsButton() {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative shrink-0 text-muted-foreground hover:bg-brand-blue/10 hover:text-brand-blue"
      aria-label={t("layout.userMenu.notificationsAria")}
      onClick={() => {
        /* reserved for notifications panel */
      }}
    >
      <Bell className="h-5 w-5" />
    </Button>
  );
}
