import { Button } from "@/mobile/components/ui/button";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface AttendanceActionsProps {
  onClockIn: () => void;
  onClockOut: () => void;
}

export const AttendanceActions = ({ onClockIn, onClockOut }: AttendanceActionsProps) => {
  const { t } = useAppTranslation();
  return (
    <div className="px-4 py-3">
      <div className="grid grid-cols-2 gap-3">
        <Button
          className="h-14 text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          onClick={onClockIn}
        >
          {t("mobileHome.clockInButton", "Clock In")}
        </Button>
        <Button
          variant="outline"
          className="h-14 text-sm border-border hover:bg-muted font-semibold"
          onClick={onClockOut}
        >
          {t("mobileHome.clockOutButton", "Clock Out")}
        </Button>
      </div>
    </div>
  );
};