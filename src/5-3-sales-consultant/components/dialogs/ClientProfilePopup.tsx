import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useToast } from "@/shared/components/ui/use-toast";
import { supabase } from "@/shared/lib/supabaseClient";
import { Loader2, Edit, Save, X } from 'lucide-react';

interface ClientProfile {
  id?: string;
  lead_id: string;
  name: string;
  code: string;
  gender: 'Male' | 'Female' | 'Other' | '';
  age: number | '';
  occupation: string;
  location: string;
}

interface ClientProfilePopupProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  clientName: string;
  organizationId: string;
  onSave?: () => void;
}

export const ClientProfilePopup: React.FC<ClientProfilePopupProps> = ({
  open,
  onClose,
  leadId,
  clientName,
  organizationId,
  onSave
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [profile, setProfile] = useState<ClientProfile>({
    lead_id: leadId,
    name: clientName,
    code: '',
    gender: '' as ClientProfile['gender'],
    age: '',
    occupation: '',
    location: ''
  });

  const isWhatsApp = leadId.startsWith('wa-');
  const isEmail = leadId.startsWith('email-');
  const conversationId = isWhatsApp ? leadId.replace(/^wa-/, '') : null;

  // Load existing profile when popup opens
  useEffect(() => {
    if (open && leadId) {
      loadClientProfile();
    }
  }, [open, leadId]);

  const loadClientProfile = async () => {
    setLoading(true);
    try {
      // Synthetic IDs: do not query lead_client_profiles (UUID column)
      if (isEmail) {
        setProfile({
          lead_id: leadId,
          name: clientName,
          code: '',
          gender: '' as ClientProfile['gender'],
          age: '',
          occupation: '',
          location: ''
        });
        setLoading(false);
        return;
      }
      if (isWhatsApp && conversationId) {
        const { data, error } = await supabase
          .from('whatsapp_conversation_client_profiles')
          .select('*')
          .eq('conversation_id', conversationId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setProfile({
            id: data.id,
            lead_id: leadId,
            name: data.name,
            code: (data as any).code || '',
            gender: (data.gender || '') as ClientProfile['gender'],
            age: data.age || '',
            occupation: data.occupation || '',
            location: data.location || ''
          });
        } else {
          setProfile({
            lead_id: leadId,
            name: clientName,
            code: '',
            gender: '' as ClientProfile['gender'],
            age: '',
            occupation: '',
            location: ''
          });
        }
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('lead_client_profiles')
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile({
          id: data.id,
          lead_id: data.lead_id,
          name: data.name,
          code: (data as any).code || '',
          gender: (data.gender || '') as ClientProfile['gender'],
          age: data.age || '',
          occupation: data.occupation || '',
          location: data.location || ''
        });
      } else {
        setProfile({
          lead_id: leadId,
          name: clientName,
          code: '',
          gender: '' as ClientProfile['gender'],
          age: '',
          occupation: '',
          location: ''
        });
      }
    } catch (error) {
      console.error('Error loading client profile:', error);
      toast({
        title: "Error",
        description: "Failed to load client profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive"
      });
      return;
    }

    if (profile.age && (Number(profile.age) <= 0 || Number(profile.age) >= 150)) {
      toast({
        title: "Validation Error", 
        description: "Age must be between 1 and 149",
        variant: "destructive"
      });
      return;
    }

    if (isEmail) {
      toast({
        title: "Not available",
        description: "Saving client profile for email leads is not supported yet.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const profileData = {
        lead_id: leadId,
        name: profile.name.trim(),
        code: profile.code.trim() || null,
        gender: profile.gender || null,
        age: profile.age ? Number(profile.age) : null,
        occupation: profile.occupation.trim() || null,
        location: profile.location.trim() || null,
        organization_id: organizationId
      };

      if (isWhatsApp && conversationId) {
        const payload = { ...profileData, conversation_id: conversationId };
        if (profile.id) {
          const { error } = await supabase
            .from('whatsapp_conversation_client_profiles')
            .update(payload)
            .eq('id', profile.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('whatsapp_conversation_client_profiles')
            .insert(payload)
            .select()
            .single();
          if (error) throw error;
          setProfile(prev => ({ ...prev, id: data.id }));
        }
      } else {
        if (profile.id) {
          const { error } = await supabase
            .from('lead_client_profiles')
            .update(profileData)
            .eq('id', profile.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('lead_client_profiles')
            .insert(profileData)
            .select()
            .single();
          if (error) throw error;
          setProfile(prev => ({ ...prev, id: data.id }));
        }
      }

      toast({
        title: "Success",
        description: "Client profile saved successfully"
      });

      setIsEditing(false);
      onSave?.();
    } catch (error) {
      console.error('Error saving client profile:', error);
      toast({
        title: "Error",
        description: "Failed to save client profile",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof ClientProfile, value: string | number) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Client Profile</span>
            {!isEditing && !loading && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="ml-2"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading profile...</span>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              {isEditing ? (
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter client name"
                />
              ) : (
                <div className="p-2 bg-gray-50 rounded border min-h-[40px] flex items-center">
                  {profile.name || 'Not specified'}
                </div>
              )}
            </div>

            {/* Code Field */}
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              {isEditing ? (
                <Input
                  id="code"
                  value={profile.code}
                  onChange={(e) => handleInputChange('code', e.target.value)}
                  placeholder="Enter client code"
                />
              ) : (
                <div className="p-2 bg-gray-50 rounded border min-h-[40px] flex items-center">
                  {profile.code || 'Not specified'}
                </div>
              )}
            </div>

            {/* Gender Field */}
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              {isEditing ? (
                <Select 
                  value={profile.gender} 
                  onValueChange={(value) => handleInputChange('gender', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-2 bg-gray-50 rounded border min-h-[40px] flex items-center">
                  {profile.gender || 'Not specified'}
                </div>
              )}
            </div>

            {/* Age Field */}
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              {isEditing ? (
                <Input
                  id="age"
                  type="number"
                  value={profile.age}
                  onChange={(e) => handleInputChange('age', e.target.value)}
                  placeholder="Enter age"
                  min="1"
                  max="149"
                />
              ) : (
                <div className="p-2 bg-gray-50 rounded border min-h-[40px] flex items-center">
                  {profile.age || 'Not specified'}
                </div>
              )}
            </div>

            {/* Occupation Field */}
            <div className="space-y-2">
              <Label htmlFor="occupation">Occupation</Label>
              {isEditing ? (
                <Input
                  id="occupation"
                  value={profile.occupation}
                  onChange={(e) => handleInputChange('occupation', e.target.value)}
                  placeholder="Enter occupation"
                />
              ) : (
                <div className="p-2 bg-gray-50 rounded border min-h-[40px] flex items-center">
                  {profile.occupation || 'Not specified'}
                </div>
              )}
            </div>

            {/* Location Field */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              {isEditing ? (
                <Input
                  id="location"
                  value={profile.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Enter location"
                />
              ) : (
                <div className="p-2 bg-gray-50 rounded border min-h-[40px] flex items-center">
                  {profile.location || 'Not specified'}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {isEditing ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  loadClientProfile(); // Reset changes
                }}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
