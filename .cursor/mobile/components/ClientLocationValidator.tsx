import { useState, useEffect } from "react";
import { MapPin, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

interface ClientLocationValidatorProps {
  onValidation: (result: LocationValidationResult) => void;
  isActive?: boolean;
  clientId?: string;
  organizationId?: string;
  className?: string;
}

export const ClientLocationValidator = ({
  onValidation,
  isActive = false,
  clientId,
  organizationId,
  className = ""
}: ClientLocationValidatorProps) => {
  const [validationResult, setValidationResult] = useState<LocationValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const { toast } = useToast();

  const getCurrentLocation = (): Promise<{latitude: number; longitude: number}> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation tidak didukung browser"));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        error => {
          reject(new Error("Gagal mendapatkan lokasi: " + error.message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  };

  const validateLocation = async () => {
    if (!organizationId) {
      const result = { is_valid: false, error: "Organization ID tidak ditemukan" };
      setValidationResult(result);
      onValidation(result);
      return;
    }

    setIsValidating(true);
    
    try {
      const location = await getCurrentLocation();
      setCurrentLocation(location);

      // Call the Supabase function to validate location
      const { data, error } = await supabase.rpc('validate_client_visit_location', {
        user_latitude: location.latitude,
        user_longitude: location.longitude,
        client_id_param: clientId || null,
        organization_id_param: organizationId
      });

      if (error) {
        console.error('Location validation error:', error);
        const result = { is_valid: false, error: "Gagal memvalidasi lokasi" };
        setValidationResult(result);
        onValidation(result);
        return;
      }

      const result = data as unknown as LocationValidationResult;
      setValidationResult(result);
      onValidation(result);

      if (!result.is_valid) {
        toast({
          title: "Lokasi Tidak Valid",
          description: result.error || `Anda berada ${Math.round(result.distance_meters || 0)}m dari lokasi yang diizinkan`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Lokasi Valid",
          description: `Anda berada di ${result.location_name} (${Math.round(result.distance_meters || 0)}m)`,
          className: "bg-success text-success-foreground"
        });
      }

    } catch (error) {
      console.error('Location validation error:', error);
      const result = { 
        is_valid: false, 
        error: error instanceof Error ? error.message : "Gagal mendapatkan lokasi" 
      };
      setValidationResult(result);
      onValidation(result);
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    if (isActive) {
      validateLocation();
    }
  }, [isActive, clientId, organizationId]);

  const getStatusIcon = () => {
    if (isValidating) {
      return <Loader className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    
    if (!validationResult) {
      return <MapPin className="h-4 w-4 text-muted-foreground" />;
    }
    
    return validationResult.is_valid ? 
      <CheckCircle className="h-4 w-4 text-success" /> : 
      <AlertCircle className="h-4 w-4 text-destructive" />;
  };

  const getStatusText = () => {
    if (isValidating) {
      return "Memvalidasi lokasi...";
    }
    
    if (!validationResult) {
      return "Tekan untuk validasi lokasi";
    }
    
    if (validationResult.is_valid) {
      return `✓ Lokasi Valid - ${validationResult.location_name} (${Math.round(validationResult.distance_meters || 0)}m)`;
    }
    
    return `✗ Lokasi Tidak Valid - ${validationResult.error || `Jarak ${Math.round(validationResult.distance_meters || 0)}m`}`;
  };

  const getStatusColor = () => {
    if (isValidating || !validationResult) {
      return "text-muted-foreground";
    }
    
    return validationResult.is_valid ? "text-success" : "text-destructive";
  };

  return (
    <div className={`bg-card border border-border rounded-lg p-3 ${className}`}>
      <div className="flex items-center gap-3">
        {getStatusIcon()}
        <div className="flex-1">
          <div className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </div>
          {validationResult && validationResult.location_type && (
            <div className="text-xs text-muted-foreground mt-1">
              Tipe: {validationResult.location_type}
            </div>
          )}
        </div>
        {!isValidating && (
          <button
            onClick={validateLocation}
            className="text-xs text-primary hover:text-primary/80 underline"
          >
            Refresh
          </button>
        )}
      </div>
    </div>
  );
};