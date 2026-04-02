
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Calendar, MapPin, Clock, User } from 'lucide-react';
import { useLocationVisits, useOfficeLocations } from '@/features/2-3-settings/hooks/useLocationManagement';
import { format } from 'date-fns';

interface LocationVisitSchedulerProps {
  onVisitScheduled?: () => void;
}

export const LocationVisitScheduler = ({ onVisitScheduled }: LocationVisitSchedulerProps) => {
  const [formData, setFormData] = useState({
    office_location_id: '',
    employee_id: '',
    visit_purpose: '',
    scheduled_start_time: '',
    scheduled_end_time: '',
    visit_notes: ''
  });

  const { scheduleVisit } = useLocationVisits();
  const { locations: officeLocations } = useOfficeLocations();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await scheduleVisit({
        ...formData,
        status: 'scheduled' as const,
        created_by: undefined // Will be set by the hook
      });
      
      setFormData({
        office_location_id: '',
        employee_id: '',
        visit_purpose: '',
        scheduled_start_time: '',
        scheduled_end_time: '',
        visit_notes: ''
      });
      
      onVisitScheduled?.();
    } catch (error) {
      console.error('Error scheduling visit:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Schedule Location Visit
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="office_location">Office Location</Label>
              <Select 
                value={formData.office_location_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, office_location_id: value }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {officeLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {location.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="visit_purpose">Visit Purpose</Label>
              <Input
                id="visit_purpose"
                value={formData.visit_purpose}
                onChange={(e) => setFormData(prev => ({ ...prev, visit_purpose: e.target.value }))}
                placeholder="e.g., Client meeting, Site inspection"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="datetime-local"
                value={formData.scheduled_start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduled_start_time: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="datetime-local"
                value={formData.scheduled_end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduled_end_time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="visit_notes">Visit Notes</Label>
            <Textarea
              id="visit_notes"
              value={formData.visit_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, visit_notes: e.target.value }))}
              placeholder="Additional details about the visit..."
              rows={3}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Scheduling...' : 'Schedule Visit'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
