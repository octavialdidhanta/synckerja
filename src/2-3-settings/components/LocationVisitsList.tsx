
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { MapPin, Clock, User, CheckCircle, XCircle } from 'lucide-react';
import { useLocationVisits } from '@/features/2-3-settings/hooks/useLocationManagement';
import { useLocationServices } from '@/1-home/hooks/useLocationServices';
import { format } from 'date-fns';

export const LocationVisitsList = () => {
  const { visits, loading, checkInToVisit, checkOutFromVisit } = useLocationVisits();
  const { getCurrentLocation } = useLocationServices();

  const handleCheckIn = async (visitId: string) => {
    try {
      const location = await getCurrentLocation();
      await checkInToVisit(visitId, {
        latitude: location.latitude,
        longitude: location.longitude
      });
    } catch (error) {
      console.error('Error during check-in:', error);
    }
  };

  const handleCheckOut = async (visitId: string) => {
    try {
      const location = await getCurrentLocation();
      await checkOutFromVisit(visitId, {
        latitude: location.latitude,
        longitude: location.longitude
      });
    } catch (error) {
      console.error('Error during check-out:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      scheduled: { variant: 'secondary' as const, label: 'Scheduled' },
      ongoing: { variant: 'default' as const, label: 'Ongoing' },
      completed: { variant: 'default' as const, label: 'Completed' },
      cancelled: { variant: 'destructive' as const, label: 'Cancelled' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.scheduled;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading visits...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Scheduled Visits</h3>
      
      {visits.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No visits scheduled</p>
          </CardContent>
        </Card>
      ) : (
        visits.map((visit) => (
          <Card key={visit.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">{visit.office_locations?.name}</span>
                    {getStatusBadge(visit.status)}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{visit.visit_purpose}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(visit.scheduled_start_time), 'MMM dd, HH:mm')} - 
                      {format(new Date(visit.scheduled_end_time), 'HH:mm')}
                    </div>
                    {visit.employees?.full_name && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {visit.employees.full_name}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {visit.status === 'scheduled' && (
                    <Button 
                      size="sm" 
                      onClick={() => handleCheckIn(visit.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Check In
                    </Button>
                  )}
                  
                  {visit.status === 'ongoing' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleCheckOut(visit.id)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Check Out
                    </Button>
                  )}
                </div>
              </div>

              {visit.visit_notes && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">{visit.visit_notes}</p>
                </div>
              )}

              {visit.actual_check_in_time && (
                <div className="mt-3 text-xs text-gray-500">
                  Checked in: {format(new Date(visit.actual_check_in_time), 'MMM dd, HH:mm')}
                  {visit.actual_check_out_time && (
                    <> • Checked out: {format(new Date(visit.actual_check_out_time), 'HH:mm')}</>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
