import { useState } from 'react';
import { Calendar, Clock, MapPin, User, FileText, Plus, Save, Compass } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useOfficeLocations } from '@/shared/hooks/organized/sales';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';

export const VisitSchedulingForm = () => {
  const { organizationId } = useCurrentOrg();
  const { addLocation } = useOfficeLocations();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    client: '',
    salesperson: '',
    date: '',
    time: '',
    location: '',
    radiusMeters: '100',
    purpose: '',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Create office location with the radius_meters field
      const locationData = {
        name: `Visit Location - ${formData.client}`,
        address: formData.location,
        latitude: 0, // This would need proper coordinates in real implementation
        longitude: 0, // This would need proper coordinates in real implementation
        radius_meters: parseInt(formData.radiusMeters) || 100,
        is_active: true,
        is_client_location: true,
        contact_person: formData.salesperson,
        notes: `Visit purpose: ${formData.purpose}. ${formData.notes}`
      };

      const result = await addLocation(locationData);
      
      if (result) {
        toast({
          title: "Success",
          description: "Visit location saved with radius setting",
        });
        
        // Reset form
        setFormData({
          client: '',
          salesperson: '',
          date: '',
          time: '',
          location: '',
          radiusMeters: '100',
          purpose: '',
          notes: ''
        });
      }
    } catch (error) {
      console.error('Error saving visit:', error);
      toast({
        title: "Error",
        description: "Failed to save visit location",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Schedule New Visit</h2>
          <p className="text-xs text-slate-500">Create a new client visit schedule</p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Quick Schedule
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="client" className="text-xs font-medium text-slate-700 flex items-center">
              <User className="h-3 w-3 mr-1" />
              Client
            </Label>
            <Select value={formData.client} onValueChange={(value) => setFormData({...formData, client: value})}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-abc">PT ABC Indonesia</SelectItem>
                <SelectItem value="pt-xyz">PT XYZ Corporation</SelectItem>
                <SelectItem value="cv-def">CV DEF Trading</SelectItem>
                <SelectItem value="pt-ghi">PT GHI Solutions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sales Person */}
          <div className="space-y-2">
            <Label htmlFor="salesperson" className="text-xs font-medium text-slate-700 flex items-center">
              <User className="h-3 w-3 mr-1" />
              Sales Person
            </Label>
            <Select value={formData.salesperson} onValueChange={(value) => setFormData({...formData, salesperson: value})}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Assign sales person" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="john">John Doe</SelectItem>
                <SelectItem value="jane">Jane Smith</SelectItem>
                <SelectItem value="mike">Mike Johnson</SelectItem>
                <SelectItem value="sarah">Sarah Wilson</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="text-xs font-medium text-slate-700 flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              Date
            </Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              className="h-9 text-xs"
            />
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label htmlFor="time" className="text-xs font-medium text-slate-700 flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              Time
            </Label>
            <Input
              id="time"
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({...formData, time: e.target.value})}
              className="h-9 text-xs"
            />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label htmlFor="location" className="text-xs font-medium text-slate-700 flex items-center">
            <MapPin className="h-3 w-3 mr-1" />
            Location
          </Label>
          <Input
            id="location"
            placeholder="Enter visit location or address"
            value={formData.location}
            onChange={(e) => setFormData({...formData, location: e.target.value})}
            className="h-9 text-xs"
          />
        </div>

        {/* Radius Meter */}
        <div className="space-y-2">
          <Label htmlFor="radiusMeters" className="text-xs font-medium text-slate-700 flex items-center">
            <Compass className="h-3 w-3 mr-1" />
            Radius Meter
          </Label>
          <Input
            id="radiusMeters"
            type="number"
            min="10"
            max="5000"
            step="10"
            placeholder="Enter radius in meters (e.g., 100)"
            value={formData.radiusMeters}
            onChange={(e) => setFormData({...formData, radiusMeters: e.target.value})}
            className="h-9 text-xs"
          />
          <p className="text-xs text-slate-500">
            Set the acceptable distance radius for the visit location (10-5000 meters)
          </p>
        </div>

        {/* Purpose */}
        <div className="space-y-2">
          <Label htmlFor="purpose" className="text-xs font-medium text-slate-700 flex items-center">
            <FileText className="h-3 w-3 mr-1" />
            Purpose
          </Label>
          <Select value={formData.purpose} onValueChange={(value) => setFormData({...formData, purpose: value})}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Select visit purpose" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="presentation">Product Presentation</SelectItem>
              <SelectItem value="negotiation">Contract Negotiation</SelectItem>
              <SelectItem value="follow-up">Follow-up Meeting</SelectItem>
              <SelectItem value="support">Customer Support</SelectItem>
              <SelectItem value="consultation">Business Consultation</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-xs font-medium text-slate-700">
            Additional Notes
          </Label>
          <Textarea
            id="notes"
            placeholder="Add any additional notes or requirements..."
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            className="h-16 text-xs resize-none"
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" className="text-xs">
            Cancel
          </Button>
          <Button type="submit" size="sm" className="text-xs">
            <Save className="h-3 w-3 mr-1" />
            Schedule Visit
          </Button>
        </div>
      </form>
    </div>
  );
};
