import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export interface GeoPosition {
  latitude: number;
  longitude: number;
}

const DEFAULT_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000,
};

/**
 * Get current position. On native (Capacitor) uses Geolocation plugin and
 * requests permissions first; on web uses navigator.geolocation.
 * Rejects with an Error with a user-friendly message (e.g. "Tidak dapat mengakses lokasi...").
 */
export async function getCurrentPosition(): Promise<GeoPosition> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location !== "granted") {
        const requested = await Geolocation.requestPermissions();
        if (requested.location !== "granted") {
          throw new Error(
            "Tidak dapat mengakses lokasi. Pastikan GPS aktif dan izin lokasi diberikan."
          );
        }
      }
      const position = await Geolocation.getCurrentPosition({
        ...DEFAULT_OPTIONS,
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Tidak dapat mengakses lokasi. Pastikan GPS aktif dan izin lokasi diberikan.";
      throw new Error(message);
    }
  }

  return new Promise<GeoPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation tidak didukung browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        const message =
          error.code === 1
            ? "Tidak dapat mengakses lokasi. Pastikan GPS aktif dan izin lokasi diberikan."
            : `Gagal mendapatkan lokasi: ${error.message}`;
        reject(new Error(message));
      },
      DEFAULT_OPTIONS
    );
  });
}
