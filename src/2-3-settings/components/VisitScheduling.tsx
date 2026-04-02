
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Calendar, MapPin, Clock, User, Plus } from 'lucide-react';
import { useOfficeLocations } from '@/features/2-3-settings/hooks/useLocationManagement';
import { useReportAttendanceSettingsLoading } from '@/2-3-attendance/context/AttendancePageLoadContext';

export const VisitScheduling = () => {
  const { locations, loading: locationsLoading } = useOfficeLocations();
  useReportAttendanceSettingsLoading(locationsLoading);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Mock data for demonstration
  const upcomingVisits = [
    {
      id: '1',
      location: 'Client Site - PT ABC Corp',
      employee: 'John Doe',
      purpose: 'System Installation',
      scheduledTime: '09:00 - 12:00',
      status: 'scheduled'
    },
    {
      id: '2',
      location: 'Project Site - Mall Construction',
      employee: 'Jane Smith',
      purpose: 'Progress Review',
      scheduledTime: '13:00 - 15:00',
      status: 'ongoing'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-info-muted text-info-foreground';
      case 'ongoing':
        return 'bg-success-muted text-success-foreground';
      case 'completed':
        return 'bg-muted text-muted-foreground';
      case 'cancelled':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (locationsLoading) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Visit Scheduling</span>
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Schedule and manage employee visits to various locations
              </p>
            </div>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Schedule Visit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar View */}
            <div className="lg:col-span-1">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-4">Select Date</h3>
                {/* Simple date display - in real implementation, use a proper calendar component */}
                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm">
                    {(() => {
                      try {
                        return selectedDate.toLocaleDateString('id-ID', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        });
                      } catch {
                        return selectedDate.toString();
                      }
                    })()}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-xs">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <div key={i} className="text-muted-foreground p-2 text-center font-medium">
                        {day}
                      </div>
                    ))}
                    {/* Simplified calendar grid */}
                    {Array.from({ length: 35 }, (_, i) => (
                      <div
                        key={i}
                        className={`cursor-pointer rounded p-2 text-center hover:bg-muted ${
                          i === 15 ? 'bg-primary text-primary-foreground' : ''
                        }`}
                      >
                        {i - 5 > 0 && i - 5 <= 31 ? i - 5 : ''}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Visit List */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                <h3 className="font-medium">Today's Scheduled Visits</h3>
                {upcomingVisits.map((visit) => (
                  <div
                    key={visit.id}
                    className="hover:bg-muted/50 rounded-lg border border-border p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="text-muted-foreground h-4 w-4" />
                          <span className="font-medium">{visit.location}</span>
                          <Badge className={getStatusColor(visit.status)}>
                            {visit.status}
                          </Badge>
                        </div>
                        
                        <div className="text-muted-foreground flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{visit.employee}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{visit.scheduledTime}</span>
                          </div>
                        </div>
                        
                        <div className="text-foreground text-sm">
                          <strong>Purpose:</strong> {visit.purpose}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm">
                          Track
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {upcomingVisits.length === 0 && (
                  <div className="text-muted-foreground py-8 text-center">
                    <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
                    <h3 className="text-lg font-medium mb-2">No visits scheduled</h3>
                    <p className="text-sm mb-4">
                      Schedule employee visits to client locations or project sites
                    </p>
                    <Button className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Schedule First Visit
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="bg-info-muted flex h-8 w-8 items-center justify-center rounded-full">
                <Calendar className="text-primary h-4 w-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Today's Visits</p>
                <p className="text-2xl font-bold">2</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="bg-success-muted flex h-8 w-8 items-center justify-center rounded-full">
                <MapPin className="text-success h-4 w-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Active Locations</p>
                <p className="text-2xl font-bold">{locations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="bg-warning-muted flex h-8 w-8 items-center justify-center rounded-full">
                <Clock className="text-warning h-4 w-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">This Week</p>
                <p className="text-2xl font-bold">8</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="bg-accent flex h-8 w-8 items-center justify-center rounded-full">
                <User className="text-accent-foreground h-4 w-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Field Employees</p>
                <p className="text-2xl font-bold">12</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
