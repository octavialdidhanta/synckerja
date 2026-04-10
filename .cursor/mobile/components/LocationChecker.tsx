import { MapPin, Navigation, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/mobile/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/config/logger";
import { getCurrentPosition } from "@/mobile/utils/geolocation";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface LocationCheckerProps {
  officeLocation?: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radius: number; // in meters
  };
}

const getRadiusMeters = (o: { radius_meters?: number; radius?: number } | null | undefined): number =>
  o?.radius_meters ?? o?.radius ?? 0;

export const LocationChecker = ({ officeLocation }: LocationCheckerProps) => {
  const { t } = useAppTranslation();
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isInOfficeArea, setIsInOfficeArea] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [nearestOffice, setNearestOffice] = useState<any>(null);
  const { toast } = useToast();

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const findNearestOffice = async (userLat: number, userLng: number) => {
    try {
      // Get current user and employee data based on active organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get user's active organization from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.active_organization_id) return null;

      // Get all active office locations for the organization
      const { data: offices } = await supabase
        .from('office_locations')
        .select('*')
        .eq('organization_id', profile.active_organization_id)
        .eq('is_active', true);

      if (!offices || offices.length === 0) return null;

      // Calculate distance to each office and find the nearest
      let nearestOffice = null;
      let minDistance = Infinity;

      for (const office of offices) {
        const dist = calculateDistance(
          userLat,
          userLng,
          office.latitude,
          office.longitude
        );

        if (dist < minDistance) {
          minDistance = dist;
          nearestOffice = {
            ...office,
            distance: Math.round(dist)
          };
        }
      }

      return nearestOffice;
    } catch (error) {
      logger.error('Error finding nearest office:', error);
      return null;
    }
  };

  const checkLocation = async () => {
    setIsCheckingLocation(true);
    try {
      const pos = await getCurrentPosition();
      const userLat = pos.latitude;
      const userLng = pos.longitude;
      setCurrentLocation({ lat: userLat, lng: userLng });

      const nearest = await findNearestOffice(userLat, userLng);

      if (nearest) {
        setNearestOffice(nearest);
        setDistance(nearest.distance);
        const radiusM = getRadiusMeters(nearest);
        const inArea = nearest.distance <= radiusM;
        setIsInOfficeArea(inArea);

        toast({
          title: inArea ? t("mobileHome.locationValid", "Lokasi Valid") : t("mobileHome.outsideOfficeArea", "Di luar Area Kantor"),
          description: inArea
            ? t("mobileHome.youAreInArea", "Anda berada di area {{name}} ({{distance}}m dari kantor)", { name: nearest.name, distance: String(nearest.distance) })
            : t("mobileHome.nearestOffice", "Kantor terdekat: {{name}} - {{distance}}m. Radius maksimal: {{radius}}m", { name: nearest.name, distance: String(nearest.distance), radius: String(radiusM) }),
          variant: inArea ? "default" : "destructive",
          duration: 4000,
        });
      } else {
        toast({
          title: t("mobileHome.error", "Error"),
          description: t("mobileHome.cannotFindOffice", "Tidak dapat menemukan data kantor"),
          variant: "destructive",
          duration: 4000,
        });
      }
    } catch (err) {
      toast({
        title: t("mobileHome.locationError", "Error Lokasi"),
        description: err instanceof Error ? err.message : t("mobileHome.locationPermissionError", "Tidak dapat mengakses lokasi. Pastikan GPS aktif dan izin lokasi diberikan."),
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsCheckingLocation(false);
    }
  };

  const displayOffice = nearestOffice || officeLocation;

  return (
    <div>
      {/* Office Info - no extra px here; parent (Absensi) already provides container px-2 so card width matches other sections */}
      {displayOffice && (
        <div className="bg-card rounded-lg p-4 mb-4 border border-border">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">{displayOffice.name}</h3>
              <p className="text-sm text-muted-foreground mb-2">{displayOffice.address}</p>
              <p className="text-xs text-muted-foreground">
                {t("mobileHome.attendanceRadius", "Radius absensi: {{meters}}m dari kantor", { meters: String(displayOffice.radius_meters ?? displayOffice.radius) })}
              </p>
            </div>
          </div>
        </div>
      )}

      {currentLocation && nearestOffice && (
        <div className="bg-card rounded-lg p-3 mb-4 border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isInOfficeArea ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Navigation className="h-4 w-4 text-destructive" />
              )}
              <span className="text-sm font-medium text-foreground">
                {isInOfficeArea ? t("mobileHome.inArea", "Dalam Area {{name}}", { name: nearestOffice.name }) : t("mobileHome.outsideOffice", "Diluar Area Kantor")}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {t("mobileHome.metersFromOffice", "{{distance}}m dari kantor", { distance: String(distance) })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Separate component for the location button
export const LocationButton = ({ officeLocation }: LocationCheckerProps) => {
  const { t } = useAppTranslation();
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isInOfficeArea, setIsInOfficeArea] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [nearestOffice, setNearestOffice] = useState<any>(null);
  const { toast } = useToast();

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const findNearestOffice = async (userLat: number, userLng: number) => {
    try {
      // Get current user and employee data based on active organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get user's active organization from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.active_organization_id) return null;

      // Get all active office locations for the organization
      const { data: offices } = await supabase
        .from('office_locations')
        .select('*')
        .eq('organization_id', profile.active_organization_id)
        .eq('is_active', true);

      if (!offices || offices.length === 0) return null;

      // Calculate distance to each office and find the nearest
      let nearestOffice = null;
      let minDistance = Infinity;

      for (const office of offices) {
        const dist = calculateDistance(
          userLat,
          userLng,
          office.latitude,
          office.longitude
        );

        if (dist < minDistance) {
          minDistance = dist;
          nearestOffice = {
            ...office,
            distance: Math.round(dist)
          };
        }
      }

      return nearestOffice;
    } catch (error) {
      logger.error('Error finding nearest office:', error);
      return null;
    }
  };

  const checkLocation = async () => {
    setIsCheckingLocation(true);
    try {
      const pos = await getCurrentPosition();
      const userLat = pos.latitude;
      const userLng = pos.longitude;
      setCurrentLocation({ lat: userLat, lng: userLng });

      const nearest = await findNearestOffice(userLat, userLng);

      if (nearest) {
        setNearestOffice(nearest);
        setDistance(nearest.distance);
        const radiusM = getRadiusMeters(nearest);
        const inArea = nearest.distance <= radiusM;
        setIsInOfficeArea(inArea);

        toast({
          title: inArea ? t("mobileHome.locationValid", "Lokasi Valid") : t("mobileHome.outsideOfficeArea", "Di luar Area Kantor"),
          description: inArea
            ? t("mobileHome.youAreInArea", "Anda berada di area {{name}} ({{distance}}m dari kantor)", { name: nearest.name, distance: String(nearest.distance) })
            : t("mobileHome.nearestOffice", "Kantor terdekat: {{name}} - {{distance}}m. Radius maksimal: {{radius}}m", { name: nearest.name, distance: String(nearest.distance), radius: String(radiusM) }),
          variant: inArea ? "default" : "destructive",
          duration: 4000,
        });
      } else {
        toast({
          title: t("mobileHome.error", "Error"),
          description: t("mobileHome.cannotFindOffice", "Tidak dapat menemukan data kantor"),
          variant: "destructive",
          duration: 4000,
        });
      }
    } catch (err) {
      toast({
        title: t("mobileHome.locationError", "Error Lokasi"),
        description: err instanceof Error ? err.message : t("mobileHome.locationPermissionError", "Tidak dapat mengakses lokasi. Pastikan GPS aktif dan izin lokasi diberikan."),
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsCheckingLocation(false);
    }
  };

  return (
    <div className="flex flex-col items-center py-2">
      <button
        onClick={checkLocation}
        disabled={isCheckingLocation}
        className={`relative p-6 rounded-full transition-all duration-300 ${
          isCheckingLocation 
            ? 'bg-primary/20 scale-110' 
            : isInOfficeArea
            ? 'bg-success/20 hover:bg-success/30'
            : 'bg-card hover:bg-muted active:scale-95'
        } shadow-floating border border-border`}
      >
        {isInOfficeArea ? (
          <CheckCircle2 
            className={`h-16 w-16 transition-all duration-300 ${
              isCheckingLocation 
                ? 'text-primary animate-pulse' 
                : 'text-success'
            }`} 
          />
        ) : (
          <MapPin 
            className={`h-16 w-16 transition-all duration-300 ${
              isCheckingLocation 
                ? 'text-primary animate-pulse' 
                : 'text-muted-foreground'
            }`} 
          />
        )}
        
        {isCheckingLocation && (
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        )}
      </button>
      
      <p className="text-sm text-muted-foreground mt-2 text-center">
        {isCheckingLocation
          ? t("mobileHome.checkingLocation", "Mengecek lokasi...")
          : t("mobileHome.tapToCheckLocation", "Tap untuk cek lokasi")}
      </p>
    </div>
  );
};