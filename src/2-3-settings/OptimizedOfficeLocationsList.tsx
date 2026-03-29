
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { MapPin, Edit, Trash2, Plus, Building, Users, Phone, User, Wifi, WifiOff } from 'lucide-react';
import { EnhancedAddOfficeLocationModal } from './EnhancedAddOfficeLocationModal';
import { EditOfficeLocationModal } from './EditOfficeLocationModal';
import { useOfficeLocations, useLocationTypes, useClients } from '@/features/2-3-settings/hooks/useLocationManagement';
import { useToast } from '@/shared/components/ui/use-toast';

const useRealtimeAttendanceFallback = () => ({
  isConnected: false,
  lastUpdate: null as Date | null,
});
import { supabase } from '@/shared/lib/supabaseClient';

export const OptimizedOfficeLocationsList = () => {
  const { locations, loading: locationsLoading, error: locationsError, refetch } = useOfficeLocations();
  const { locationTypes } = useLocationTypes();
  const { clients } = useClients();
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
          <div className="text-center text-red-600">
            Error loading office locations: {locationsError instanceof Error ? locationsError.message : 'Unknown error'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Building className="h-5 w-5" />
                  <span>Office Locations</span>
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Manage office locations with real-time updates
                </p>
              </div>
              
              {/* Real-time Status Indicator */}
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <Wifi className="h-4 w-4" />
                    <span className="text-xs">Live</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-gray-400">
                    <WifiOff className="h-4 w-4" />
                    <span className="text-xs">Offline</span>
                  </div>
                )}
                
                {lastUpdate && (
                  <Badge variant="outline" className="text-xs">
                    Updated {lastUpdate.toLocaleTimeString()}
                  </Badge>
                )}
              </div>
            </div>
            
            <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Location
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {locationsLoading ? (
            <div className="text-center py-8">
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No Office Locations</h3>
              <p className="text-sm mb-4">Add your first office location to get started</p>
              <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Office Location
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {locations.map((location) => (
                <div
                  key={location.id}
                  className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium">{location.name}</h4>
                      <Badge 
                        variant="secondary" 
                        className="text-xs"
                        style={{ 
                          backgroundColor: `${getLocationTypeColor(location.location_type_id)}15`,
                          color: getLocationTypeColor(location.location_type_id),
                          borderColor: `${getLocationTypeColor(location.location_type_id)}30`
                        }}
                      >
                        {getLocationTypeName(location.location_type_id)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {location.radius_meters}m radius
                      </Badge>
                      {location.is_client_location && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          Client Location
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="h-3 w-3" />
                        <span>{location.formatted_address || location.address}</span>
                      </div>
                      
                      {location.contact_person && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="h-3 w-3" />
                          <span>{location.contact_person}</span>
                          {location.contact_phone && (
                            <>
                              <Phone className="h-3 w-3 ml-2" />
                              <span>{location.contact_phone}</span>
                            </>
                          )}
                        </div>
                      )}
                      
                      {location.is_client_location && getClientName(location.client_id) && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Building className="h-3 w-3" />
                          <span>Client: {getClientName(location.client_id)}</span>
                        </div>
                      )}
                      
                      {location.notes && (
                        <div className="text-sm text-gray-500 italic">
                          {location.notes}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      Coordinates: {location.latitude}, {location.longitude}
                      {location.last_verified && (
                        <span className="ml-2">• Verified: {(() => {
                          try {
                            const date = new Date(location.last_verified);
                            return isNaN(date.getTime()) ? location.last_verified : date.toLocaleDateString();
                          } catch {
                            return location.last_verified;
                          }
                        })()}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(location)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDelete(location.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EnhancedAddOfficeLocationModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
      />

      <EditOfficeLocationModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        location={selectedLocation}
        onLocationUpdated={handleLocationUpdated}
      />
    </>
  );
};
