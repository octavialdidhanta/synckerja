
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { MapPin, Edit, Trash2, Plus, Building, Phone, User, Wifi, WifiOff } from 'lucide-react';
import { EnhancedAddOfficeLocationModal } from '../modals/EnhancedAddOfficeLocationModal';
import { EditOfficeLocationModal } from '../modals/EditOfficeLocationModal';
import { useOfficeLocations, useLocationTypes, useClients } from '@/features/2-3-settings/hooks/useLocationManagement';
import { useReportAttendanceSettingsLoading } from '@/2-3-attendance/context/AttendancePageLoadContext';
import { AttendanceSettingsHeaderActions } from '@/2-3-settings/components/AttendanceSettingsHeaderActions';
import { useToast } from '@/shared/components/ui/use-toast';

const useRealtimeAttendanceFallback = () => ({
  isConnected: false,
  lastUpdate: null as Date | null,
});
import { supabase } from '@/shared/lib/supabaseClient';

export const OptimizedOfficeLocationsList = () => {
  const { locations, loading: locationsLoading, error: locationsError, refetch } = useOfficeLocations();
  const { locationTypes, loading: locationTypesLoading } = useLocationTypes();
  const { clients, loading: clientsLoading } = useClients();
  const sectionLoading = locationsLoading || locationTypesLoading || clientsLoading;
  useReportAttendanceSettingsLoading(sectionLoading);
  const { isConnected, lastUpdate } = useRealtimeAttendanceFallback();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const { toast } = useToast();

  const getLocationTypeName = (locationTypeId?: string) => {
    if (!locationTypeId) return 'General';
    const type = locationTypes.find(t => t.id === locationTypeId);
    return type?.name || 'General';
  };

  const getLocationTypeColor = (locationTypeId?: string) => {
    if (!locationTypeId) return '#6B7280';
    const type = locationTypes.find(t => t.id === locationTypeId);
    return type?.color || '#6B7280';
  };

  const getClientName = (clientId?: string) => {
    if (!clientId) return null;
    const client = clients.find(c => c.id === clientId);
    return client?.company_name;
  };

  const handleEdit = (location) => {
    setSelectedLocation(location);
    setShowEditModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this office location?')) return;

    try {
      const { error } = await supabase
        .from('office_locations')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Office location deleted successfully",
      });
      
      refetch();
    } catch (error) {
      console.error('Error deleting office location:', error);
      toast({
        title: "Error",
        description: "Failed to delete office location",
        variant: "destructive",
      });
    }
  };

  const handleLocationUpdated = () => {
    refetch();
  };

  if (locationsError) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            Error loading office locations: {locationsError instanceof Error ? locationsError.message : 'Unknown error'}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sectionLoading) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AttendanceSettingsHeaderActions>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-1 text-success">
              <Wifi className="h-4 w-4" />
              <span className="text-xs">Live</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground">
              <WifiOff className="h-4 w-4" />
              <span className="text-xs">Offline</span>
            </div>
          )}
          {lastUpdate ? (
            <Badge variant="outline" className="text-xs">
              Updated {lastUpdate.toLocaleTimeString()}
            </Badge>
          ) : null}
          <Button onClick={() => setShowAddModal(true)} size="sm" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Location
          </Button>
        </div>
      </AttendanceSettingsHeaderActions>

      {locations.length === 0 ? (
        <div className="flex w-full min-h-0 flex-1 flex-col items-center justify-center rounded-lg border border-border text-center">
          <Building className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="mb-1 text-base font-medium text-foreground">No Office Locations</h3>
          <p className="text-sm text-muted-foreground">
            Add your first office location to get started
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto">
          {locations.map((location) => (
            <div
              key={location.id}
              className="flex items-start justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium text-foreground">{location.name}</h4>
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    style={{
                      backgroundColor: `${getLocationTypeColor(location.location_type_id)}15`,
                      color: getLocationTypeColor(location.location_type_id),
                      borderColor: `${getLocationTypeColor(location.location_type_id)}30`,
                    }}
                  >
                    {getLocationTypeName(location.location_type_id)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {location.radius_meters}m radius
                  </Badge>
                  {location.is_client_location ? (
                    <Badge
                      variant="outline"
                      className="border-success/30 bg-success-muted text-xs text-success-foreground"
                    >
                      Client Location
                    </Badge>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>{location.formatted_address || location.address}</span>
                  </div>

                  {location.contact_person ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3 w-3 shrink-0" />
                      <span>{location.contact_person}</span>
                      {location.contact_phone ? (
                        <>
                          <Phone className="ml-2 h-3 w-3 shrink-0" />
                          <span>{location.contact_phone}</span>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {location.is_client_location && getClientName(location.client_id) ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building className="h-3 w-3 shrink-0" />
                      <span>Client: {getClientName(location.client_id)}</span>
                    </div>
                  ) : null}

                  {location.notes ? (
                    <div className="text-sm italic text-muted-foreground">{location.notes}</div>
                  ) : null}
                </div>

                <div className="text-xs text-muted-foreground">
                  Coordinates: {location.latitude}, {location.longitude}
                  {location.last_verified ? (
                    <span className="ml-2">
                      • Verified:{' '}
                      {(() => {
                        try {
                          const date = new Date(location.last_verified);
                          return isNaN(date.getTime())
                            ? location.last_verified
                            : date.toLocaleDateString();
                        } catch {
                          return location.last_verified;
                        }
                      })()}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="ml-4 flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(location)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(location.id)}
                  className="text-destructive hover:text-destructive/90"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <EnhancedAddOfficeLocationModal open={showAddModal} onOpenChange={setShowAddModal} />

      <EditOfficeLocationModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        location={selectedLocation}
        onLocationUpdated={handleLocationUpdated}
      />
    </div>
  );
};
