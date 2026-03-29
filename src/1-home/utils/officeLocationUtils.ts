import { supabase } from '@/shared/lib/supabaseClient';

export interface OfficeLocationResult {
  officeLocationId: string | null;
  distanceMeters: number | null;
  officeName: string | null;
  isWithinRadius: boolean;
}

export const findNearestOfficeLocation = async (
  latitude: number,
  longitude: number,
  organizationId: string
): Promise<OfficeLocationResult> => {
  try {
    console.log('Finding nearest office for:', { latitude, longitude, organizationId });
    
    // Get all office locations for the organization
    const { data: officeLocations, error } = await supabase
      .from('office_locations')
      .select('id, name, latitude, longitude, radius_meters')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching office locations:', error);
      return { officeLocationId: null, distanceMeters: null, officeName: null, isWithinRadius: false };
    }

    if (!officeLocations || officeLocations.length === 0) {
      console.log('No office locations found for organization');
      return { officeLocationId: null, distanceMeters: null, officeName: null, isWithinRadius: false };
    }

    console.log('Found office locations:', officeLocations);

    let nearestOffice = null;
    let shortestDistance = Infinity;

    // Calculate distance to each office location and find the nearest one
    for (const office of officeLocations) {
      const distance = calculateDistance(
        latitude,
        longitude,
        office.latitude,
        office.longitude
      );

      console.log(`Distance to ${office.name}: ${distance}m (radius: ${office.radius_meters}m)`);

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestOffice = office;
      }
    }

    if (nearestOffice) {
      const isWithinRadius = shortestDistance <= nearestOffice.radius_meters;
      console.log(`Nearest office: ${nearestOffice.name}, Distance: ${shortestDistance}m, Within radius: ${isWithinRadius}`);
      
      // Always return the nearest office, regardless of radius
      // We'll use the nearest office ID even if it's outside the radius
      return {
        officeLocationId: nearestOffice.id,
        distanceMeters: Math.round(shortestDistance),
        officeName: nearestOffice.name,
        isWithinRadius
      };
    } else {
      console.log('No office locations found');
      return { officeLocationId: null, distanceMeters: null, officeName: null, isWithinRadius: false };
    }
  } catch (error) {
    console.error('Error finding nearest office:', error);
    return { officeLocationId: null, distanceMeters: null, officeName: null, isWithinRadius: false };
  }
};

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

