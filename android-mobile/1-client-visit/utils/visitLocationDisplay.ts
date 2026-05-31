import type { ClientVisit } from "@/mobile/1-client-visit/hooks/useClientVisitData";
import type { ClientLocation } from "@/mobile/1-client-visit/hooks/useClientLocations";
import type { OpenGoogleMapsOptions } from "@/mobile-app/utils/openGoogleMaps";

export function formatVisitPlannedTimeRange(
  visit: Pick<ClientVisit, "planned_start_time" | "planned_end_time">,
  flexibleLabel: string,
): string {
  const start = visit.planned_start_time?.slice(0, 5);
  const end = visit.planned_end_time?.slice(0, 5);
  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  return flexibleLabel;
}

export function getVisitSiteAddress(visit: ClientVisit, fallbackLabel: string): string {
  return (
    visit.validated_location?.address?.trim() ||
    visit.validated_location?.name?.trim() ||
    visit.client?.address?.trim() ||
    fallbackLabel
  );
}

export function getVisitMapsOptions(visit: ClientVisit): OpenGoogleMapsOptions {
  return {
    latitude: visit.validated_location?.latitude,
    longitude: visit.validated_location?.longitude,
    address: visit.validated_location?.address,
    label: visit.client?.company_name || visit.validated_location?.name,
  };
}

export function getOfficeLocationMapsOptions(location: ClientLocation): OpenGoogleMapsOptions {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    address: location.address,
    label: location.clients?.company_name || location.name,
  };
}

export function findVisitForLocation(visits: ClientVisit[], locationId: string): ClientVisit | undefined {
  return visits.find((visit) => visit.validated_location_id === locationId);
}

/** Hide assigned site when today's visit is already ongoing or completed. */
export function shouldShowLocationInNotifications(
  locationId: string,
  visits: ClientVisit[],
  todayYmd: string,
): boolean {
  const todayVisit = visits.find(
    (visit) => visit.validated_location_id === locationId && visit.visit_date === todayYmd,
  );
  if (!todayVisit) return true;
  return todayVisit.status !== "ongoing" && todayVisit.status !== "completed";
}

export function filterVisibleNotificationLocations(
  locations: ClientLocation[],
  visits: ClientVisit[],
  todayYmd: string,
): ClientLocation[] {
  return locations.filter((location) =>
    shouldShowLocationInNotifications(location.id, visits, todayYmd),
  );
}

/** Pending execution visits for today — source of truth is `client_visits`, not office_locations. */
export function getPendingScheduledVisitsForToday(
  visits: ClientVisit[],
  todayYmd: string,
): ClientVisit[] {
  return visits.filter(
    (visit) => visit.visit_date === todayYmd && visit.status === "scheduled",
  );
}

/** Visit record with both start and end execution timestamps. */
export function isExecutedClientVisit(
  visit: Pick<ClientVisit, "status" | "actual_start_time" | "actual_end_time">,
): boolean {
  return (
    visit.status === "completed" &&
    Boolean(visit.actual_start_time?.trim()) &&
    Boolean(visit.actual_end_time?.trim())
  );
}

export function findExecutedVisitAtLocation(
  visits: ClientVisit[],
  locationId: string,
  todayYmd: string,
): ClientVisit | undefined {
  return visits.find(
    (visit) =>
      visit.visit_date === todayYmd &&
      visit.validated_location_id === locationId &&
      isExecutedClientVisit(visit),
  );
}

/** Block start when today's visits are all done and none remain scheduled. */
export function isStartVisitBlockedForToday(visits: ClientVisit[], todayYmd: string): boolean {
  const todayVisits = visits.filter((visit) => visit.visit_date === todayYmd);
  const hasPendingScheduled = todayVisits.some((visit) => visit.status === "scheduled");
  if (hasPendingScheduled) return false;
  return todayVisits.some((visit) => isExecutedClientVisit(visit));
}
