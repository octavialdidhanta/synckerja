import { Button } from "@/mobile/components/ui/button";
import { MapPin, Clock } from "lucide-react";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface LocationValidationResult {
  is_valid: boolean;
  location_id?: string;
  location_name?: string;
  location_type?: string;
  distance_meters?: number;
  allowed_radius_meters?: number;
  accuracy_meters?: number;
  error?: string;
}

interface ClientVisitActionsProps {
  onStartVisit: () => void;
  onEndVisit: () => void;
  hasActiveVisit: boolean;
  isLoading?: boolean;
}

export const ClientVisitActions = ({
  onStartVisit,
  onEndVisit,
  hasActiveVisit,
  isLoading = false
}: ClientVisitActionsProps) => {
  const { t } = useAppTranslation();
  const handleStartVisit = () => {
    onStartVisit();
  };

  const handleEndVisit = () => {
    onEndVisit();
  };

  return (
    <div className="px-4 py-3">
      {/* Action Buttons - padding sama seperti AttendanceActions di Home */}
      <div className="grid grid-cols-2 gap-3">
        <Button 
          onClick={handleStartVisit}
          disabled={hasActiveVisit || isLoading}
          className="h-14 flex flex-col gap-1 text-sm font-semibold"
          variant={hasActiveVisit ? "outline" : "default"}
        >
          <MapPin className="h-5 w-5" />
          <span className="text-xs">
            {hasActiveVisit ? t("clientVisit.alreadyStarted", "Sudah Mulai") : t("clientVisit.startVisit", "Mulai Kunjungan")}
          </span>
        </Button>
        
        <Button 
          onClick={handleEndVisit}
          disabled={!hasActiveVisit || isLoading}
          className="h-14 flex flex-col gap-1 text-sm font-semibold"
          variant={!hasActiveVisit ? "outline" : "destructive"}
        >
          <Clock className="h-5 w-5" />
          <span className="text-xs">
            {!hasActiveVisit ? t("clientVisit.notStarted", "Belum Mulai") : t("clientVisit.endVisit", "Selesai Kunjungan")}
          </span>
        </Button>
      </div>
    </div>
  );
};