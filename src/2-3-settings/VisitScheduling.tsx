
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Calendar, MapPin, Clock, User, Plus } from 'lucide-react';
import { useOfficeLocations } from '@/features/2-3-settings/hooks/useLocationManagement';

export const VisitScheduling = () => {
  const { locations } = useOfficeLocations();
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
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
              <p className="text-sm text-gray-600 mt-1">
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
                  <div className="text-sm text-gray-600">
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
                      <div key={i} className="p-2 text-center font-medium text-gray-500">
                        {day}
                      </div>
                    ))}
                    {/* Simplified calendar grid */}
                    {Array.from({ length: 35 }, (_, i) => (
                      <div
                        key={i}
                        className={`p-2 text-center cursor-pointer hover:bg-gray-100 rounded ${
                          i === 15 ? 'bg-blue-500 text-white' : ''
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
                    className="border rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{visit.location}</span>
                          <Badge className={getStatusColor(visit.status)}>
                            {visit.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{visit.employee}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{visit.scheduledTime}</span>
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-700">
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
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
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
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Today's Visits</p>
                <p className="text-2xl font-bold">2</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <MapPin className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Locations</p>
                <p className="text-2xl font-bold">{locations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">This Week</p>
                <p className="text-2xl font-bold">8</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Field Employees</p>
                <p className="text-2xl font-bold">12</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
