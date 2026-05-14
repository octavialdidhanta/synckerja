import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useToast } from "@/shared/components/ui/use-toast";
import { supabase } from "@/shared/lib/supabaseClient";
import { Loader2, Edit, Save, X, User, Phone, Mail, Hash, Briefcase, MapPin } from 'lucide-react';

/** Mask 4 digit terakhir nomor telepon untuk privasi di UI. */
function maskPhoneLast4(phone: string | null | undefined): string {
  if (phone == null || phone === '') return '';
  const s = String(phone).trim();
  if (s.length <= 4) return '****';
  return s.slice(0, -4) + '****';
}

/** Email: hanya huruf paling depan dan paling belakang sebelum @ yang ditampilkan, selebihnya masking; domain tetap. */
function maskEmailForDisplay(email: string | null | undefined): string {
  if (email == null || email === '') return '';
  const s = String(email).trim();
  const at = s.indexOf('@');
  if (at <= 0) return s;
  const local = s.slice(0, at);
  const domain = s.slice(at);
  if (local.length === 0) return domain;
  if (local.length === 1) return local + domain;
  return local[0] + '*'.repeat(local.length - 2) + local[local.length - 1] + domain;
}

interface ClientProfile {
  id?: string;
  lead_id: string;
  name: string;
  code: string;
  gender: 'Male' | 'Female' | 'Other' | '';
  age: number | '';
  occupation: string;
  location: string;
  phone_number: string;
  email: string;
}

interface ClientProfilePopupProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  clientName: string;
  organizationId: string;
  /** Untuk lead WhatsApp: nomor WA (customer_wa_id) dipakai auto-isi Nomor Telepon */
  initialPhoneNumber?: string;
  onSave?: () => void;
}

export const ClientProfilePopup: React.FC<ClientProfilePopupProps> = ({
  open,
  onClose,
  leadId,
  clientName,
  organizationId,
  initialPhoneNumber = '',
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
    location: '',
    phone_number: initialPhoneNumber,
    email: ''
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
      // Email leads: no client profile table yet; show empty form (do not query lead_client_profiles — lead_id is synthetic)
      if (isEmail) {
        setProfile({
          lead_id: leadId,
          name: clientName,
          code: '',
          gender: '' as ClientProfile['gender'],
          age: '',
          occupation: '',
          location: '',
          phone_number: '',
          email: ''
        });
        setLoading(false);
        return;
      }
      if (isWhatsApp && conversationId) {
        const { data, error } = await supabase
          .from('whatsapp_conversation_client_profiles')
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('organization_id', organizationId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          const savedPhone = (data as any).phone_number || '';
          setProfile({
            id: data.id,
            lead_id: leadId,
            name: data.name,
            code: (data as any).code || '',
            gender: (data.gender || '') as ClientProfile['gender'],
            age: data.age ?? '',
            occupation: data.occupation || '',
            location: data.location || '',
            phone_number: savedPhone || initialPhoneNumber,
            email: (data as any).email || ''
          });
        } else {
          setProfile({
            lead_id: leadId,
            name: clientName,
            code: '',
            gender: '' as ClientProfile['gender'],
            age: '',
            occupation: '',
            location: '',
            phone_number: initialPhoneNumber,
            email: ''
          });
        }
      } else {
        const { data, error } = await supabase
          .from('lead_client_profiles')
          .select('*')
          .eq('lead_id', leadId)
          .eq('organization_id', organizationId)
          .order('updated_at', { ascending: false })
          .limit(1)
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
            location: data.location || '',
            phone_number: (data as any).phone_number || '',
            email: (data as any).email || ''
          });
        } else {
          setProfile({
            lead_id: leadId,
            name: clientName,
            code: '',
            gender: '' as ClientProfile['gender'],
            age: '',
            occupation: '',
            location: '',
            phone_number: '',
            email: ''
          });
        }
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

    setSaving(true);
    try {
      const baseData = {
        name: profile.name.trim(),
        code: profile.code.trim() || null,
        gender: profile.gender || null,
        age: profile.age ? Number(profile.age) : null,
        occupation: profile.occupation.trim() || null,
        location: profile.location.trim() || null,
        phone_number: profile.phone_number.trim() || null,
        email: profile.email.trim() || null,
        organization_id: organizationId
      };

      if (isEmail) {
        toast({
          title: "Not available",
          description: "Saving client profile for email leads is not supported yet.",
          variant: "destructive"
        });
        setSaving(false);
        return;
      }
      if (isWhatsApp && conversationId) {
        const payload = { ...baseData, conversation_id: conversationId, updated_at: new Date().toISOString() };
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
        const profileData = { ...baseData, lead_id: leadId };
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

  // Spacing: satu ukuran konsisten (4 = 1rem / 16px) untuk padding & margin
  const spacing = "p-4";
  const spaceBetween = "space-y-4";
  const fieldViewClass = "flex items-center gap-3 px-4 py-3 rounded-xl min-h-[44px] text-sm border border-sky-100/80 bg-sky-50/40 text-slate-800";
  const labelClass = "text-xs font-medium text-sky-700/90 uppercase tracking-wider";
  const iconSoft = "h-4 w-4 text-sky-500/80 flex-shrink-0";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent hideCloseButton className="w-[min(92vw,540px,88vh)] h-[min(92vw,540px,88vh)] max-w-[92vw] max-h-[88vh] grid grid-rows-[auto_1fr_auto] gap-0 p-0 overflow-hidden rounded-2xl border border-sky-100 shadow-2xl bg-gradient-to-b from-white via-sky-50/20 to-violet-50/20">
        {/* Header */}
        <div className={`flex-shrink-0 ${spacing} border-b border-sky-100/80 bg-gradient-to-r from-sky-50/80 to-violet-50/50 rounded-t-2xl`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-sky-100 to-sky-200/80 flex items-center justify-center text-sky-600 shadow-sm">
                <User className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-semibold text-slate-800 truncate">Client Profile</DialogTitle>
                <p className="text-sm text-sky-600/80 mt-1">View and edit client information</p>
              </div>
            </div>
            {!isEditing && !loading && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="flex-shrink-0 border-sky-200 text-sky-700 bg-white/80 hover:bg-sky-50 hover:border-sky-300"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className={`flex flex-col items-center justify-center ${spaceBetween} ${spacing} flex-1 min-h-0`}>
            <div className="w-12 h-12 rounded-full border-2 border-sky-100 border-t-sky-500 animate-spin flex items-center justify-center" />
            <span className="text-sm text-sky-600/80">Loading profile...</span>
          </div>
        ) : (
          <div className={`${spaceBetween} ${spacing} min-h-0 overflow-y-auto seamless-scroll flex-1`}>
            {/* Section: Contact */}
            <section className={spaceBetween}>
              <h3 className={labelClass}>Contact</h3>
              <div className={`rounded-xl border border-sky-100/80 bg-white/90 shadow-sm ${spacing} ${spaceBetween}`}>
                <div className={spaceBetween}>
                  <Label htmlFor="name" className="text-slate-600 text-sm font-medium">Name *</Label>
                  {isEditing ? (
                    <Input id="name" value={profile.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="Enter client name" className="h-10" />
                  ) : (
                    <div className={fieldViewClass}><User className={iconSoft} />{profile.name || '—'}</div>
                  )}
                </div>
                <div className={spaceBetween}>
                  <Label htmlFor="phone_number" className="text-slate-600 text-sm font-medium">Nomor Telepon</Label>
                  {isEditing ? (
                    <Input id="phone_number" type="tel" value={profile.phone_number} onChange={(e) => handleInputChange('phone_number', e.target.value)} placeholder="Enter phone number" className="h-10" />
                  ) : (
                    <div className={fieldViewClass}><Phone className={iconSoft} />{profile.phone_number ? maskPhoneLast4(profile.phone_number) : '—'}</div>
                  )}
                </div>
                <div className={spaceBetween}>
                  <Label htmlFor="email" className="text-slate-600 text-sm font-medium">Email</Label>
                  {isEditing ? (
                    <Input id="email" type="email" value={profile.email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="Enter email" className="h-10" />
                  ) : (
                    <div className={fieldViewClass}><Mail className={iconSoft} />{profile.email ? maskEmailForDisplay(profile.email) : '—'}</div>
                  )}
                </div>
              </div>
            </section>

            {/* Section: Profile details */}
            <section className={spaceBetween}>
              <h3 className={labelClass}>Profile details</h3>
              <div className={`rounded-xl border border-violet-100/80 bg-white/90 shadow-sm ${spacing} ${spaceBetween}`}>
                <div className={spaceBetween}>
                  <Label htmlFor="code" className="text-slate-600 text-sm font-medium">Code</Label>
                  {isEditing ? (
                    <Input id="code" value={profile.code} onChange={(e) => handleInputChange('code', e.target.value)} placeholder="Client code" className="h-10" />
                  ) : (
                    <div className={fieldViewClass}><Hash className={iconSoft} />{profile.code || '—'}</div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className={spaceBetween}>
                    <Label htmlFor="gender" className="text-slate-600 text-sm font-medium">Gender</Label>
                    {isEditing ? (
                      <Select value={profile.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className={fieldViewClass}>{profile.gender || '—'}</div>
                    )}
                  </div>
                  <div className={spaceBetween}>
                    <Label htmlFor="age" className="text-slate-600 text-sm font-medium">Age</Label>
                    {isEditing ? (
                      <Input id="age" type="number" value={profile.age} onChange={(e) => handleInputChange('age', e.target.value)} placeholder="Age" min="1" max="149" className="h-10" />
                    ) : (
                      <div className={fieldViewClass}>{profile.age || '—'}</div>
                    )}
                  </div>
                </div>
                <div className={spaceBetween}>
                  <Label htmlFor="occupation" className="text-slate-600 text-sm font-medium">Occupation</Label>
                  {isEditing ? (
                    <Input id="occupation" value={profile.occupation} onChange={(e) => handleInputChange('occupation', e.target.value)} placeholder="Occupation" className="h-10" />
                  ) : (
                    <div className={fieldViewClass}><Briefcase className={iconSoft} />{profile.occupation || '—'}</div>
                  )}
                </div>
                <div className={spaceBetween}>
                  <Label htmlFor="location" className="text-slate-600 text-sm font-medium">Location</Label>
                  {isEditing ? (
                    <Input id="location" value={profile.location} onChange={(e) => handleInputChange('location', e.target.value)} placeholder="Location" className="h-10" />
                  ) : (
                    <div className={fieldViewClass}><MapPin className={iconSoft} />{profile.location || '—'}</div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Footer - padding sama dengan header & body */}
        <div className={`flex-shrink-0 border-t border-sky-100/80 bg-gradient-to-r from-sky-50/50 to-violet-50/30 rounded-b-2xl ${spacing}`}>
          <DialogFooter className="flex gap-4">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => { setIsEditing(false); loadClientProfile(); }}
                  disabled={saving}
                  className="border-sky-200 text-sky-700 hover:bg-sky-50"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving} className="bg-sky-500 hover:bg-sky-600 text-white shadow-sm">
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Save</>
                  )}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={handleClose} className="border-sky-200 text-sky-700 hover:bg-sky-50 w-full sm:w-auto">
                Close
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
