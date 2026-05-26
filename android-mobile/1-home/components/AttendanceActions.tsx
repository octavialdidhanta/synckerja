import { Button } from "@/mobile-app/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface AttendanceActionsProps {
  onClockIn: () => void;
  onClockOut: () => void;
  clockInDisabled?: boolean;
  clockOutDisabled?: boolean;
}

export const AttendanceActions = ({
  onClockIn,
  onClockOut,
  clockInDisabled = false,
  clockOutDisabled = false,
}: AttendanceActionsProps) => {
  const { t } = useAppTranslation();
  return (
    <div className="px-4 py-3">
      <div className="grid grid-cols-2 gap-3">
        <Button
          className="h-14 text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          onClick={onClockIn}
          disabled={clockInDisabled}
        >
          {t("mobileHome.clockInButton", "Clock In")}
        </Button>
        <Button
          variant="outline"
          className="h-14 text-sm border-border hover:bg-muted font-semibold"
          onClick={onClockOut}
          disabled={clockOutDisabled}
        >
          {t("mobileHome.clockOutButton", "Clock Out")}
        </Button>
      </div>
    </div>
  );
};
