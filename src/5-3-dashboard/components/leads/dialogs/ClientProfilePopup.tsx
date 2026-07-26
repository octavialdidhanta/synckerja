import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useToast } from "@/shared/components/ui/use-toast";
import { supabase } from "@/shared/lib/supabaseClient";
import { Loader2, Edit, Save, X, User, Phone, Mail, Hash, Briefcase, MapPin, Megaphone, Target } from 'lucide-react';
import {
  fetchLeadDisplayFallback,
  fetchLeadSubmissionForProfile,
  isPlaceholderLeadClientName,
  resolveClientProfileContactFields,
  updateLeadSubmissionProfile,
} from '@/shared/lib/leadSubmissionProfile';

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

function humanizeFormDataKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFormDataValue(value: unknown, yesLabel: string, noLabel: string): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? yesLabel : noLabel;
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  return String(value);
}

function normalizeFormDataRecord(
  raw: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const keys = Object.keys(raw);
  if (keys.length === 0) return null;
  return raw;
}

interface ClientProfile {
  submissionId?: string;
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
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canEditSubmission, setCanEditSubmission] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown> | null>(null);
  const [leadMagnetCampaignName, setLeadMagnetCampaignName] = useState<string | null>(null);
  const [leadMagnetTargetMarket, setLeadMagnetTargetMarket] = useState<string | null>(null);
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

  // Guards in-flight silent refreshes so they never overwrite an edit draft.
  const isEditingRef = useRef(isEditing);
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    if (open && leadId) {
      loadClientProfile();
    }
  }, [open, leadId]);

  // Silent refresh in view mode when backend auto-fills the profile
  // (e.g. email detected in an inbound livechat message).
  useEffect(() => {
    if (!open || isEditing || isEmail || !leadId) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSilentRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        loadClientProfile({ silent: true });
      }, 400);
    };

    const channel = supabase
      .channel(`client-profile-popup-${leadId}`)
      .on(
        'postgres_changes',
        isWhatsApp && conversationId
          ? {
              event: 'UPDATE',
              schema: 'public',
              table: 'whatsapp_conversations',
              filter: `id=eq.${conversationId}`,
            }
          : { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` },
        scheduleSilentRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditing, leadId]);

  const loadClientProfile = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setLoading(true);
      setCanEditSubmission(false);
      setFormData(null);
      setLeadMagnetCampaignName(null);
      setLeadMagnetTargetMarket(null);
    }
    try {
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
        if (silent && isEditingRef.current) return;
        setCanEditSubmission(true);
        if (data) {
          const savedPhone = (data as { phone_number?: string }).phone_number || '';
          setProfile({
            id: data.id,
            submissionId: data.id,
            lead_id: leadId,
            name: data.name,
            code: (data as { code?: string }).code || '',
            gender: (data.gender || '') as ClientProfile['gender'],
            age: data.age ?? '',
            occupation: data.occupation || '',
            location: data.location || '',
            phone_number: savedPhone || initialPhoneNumber,
            email: (data as { email?: string }).email || ''
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
        setLoading(false);
        return;
      }

      const submission = await fetchLeadSubmissionForProfile(leadId, organizationId);
      const fallback = await fetchLeadDisplayFallback(leadId, organizationId);
      if (silent && isEditingRef.current) return;
      const resolved = resolveClientProfileContactFields({
        submission,
        lead: fallback,
        clientNameProp: clientName,
        initialPhoneNumber,
      });

      if (submission) {
        setCanEditSubmission(true);
        setFormData(normalizeFormDataRecord(submission.form_data));

        let campaignName = submission.lead_magnet_campaign_name?.trim() || null;
        const targetMarket = submission.lead_magnet_target_market?.trim() || null;
        if (!campaignName && submission.lead_magnet_campaign_id) {
          const { data: campaignRow } = await supabase
            .from('lead_magnet_campaigns')
            .select('name')
            .eq('id', submission.lead_magnet_campaign_id)
            .eq('organization_id', organizationId)
            .maybeSingle();
          campaignName = campaignRow?.name?.trim() || null;
        }
        if (submission.lead_magnet_campaign_id || campaignName || targetMarket) {
          setLeadMagnetCampaignName(campaignName);
          setLeadMagnetTargetMarket(targetMarket);
        }

        setProfile({
          submissionId: submission.id,
          lead_id: leadId,
          name: resolved.name,
          code: submission.code || '',
          gender: (submission.gender || '') as ClientProfile['gender'],
          age: submission.age ?? '',
          occupation: submission.occupation || '',
          location: submission.location || '',
          phone_number: resolved.phone_number,
          email: resolved.email,
        });

        // Heal floating stubs that still store placeholder name / empty phone after WA merge.
        const healPatch: Record<string, string> = {};
        if (
          isPlaceholderLeadClientName(submission.name) &&
          resolved.name &&
          !isPlaceholderLeadClientName(resolved.name)
        ) {
          healPatch.name = resolved.name;
        }
        if (!String(submission.phone_number ?? '').trim() && resolved.phone_number) {
          healPatch.phone_number = resolved.phone_number;
        }
        if (!String(submission.email ?? '').trim() && resolved.email) {
          healPatch.email = resolved.email;
        }
        if (Object.keys(healPatch).length > 0) {
          void supabase
            .from('lead_submissions')
            .update({ ...healPatch, updated_at: new Date().toISOString() })
            .eq('id', submission.id)
            .then(({ error }) => {
              if (error) console.warn('ClientProfile heal submission:', error.message);
            });
        }

        if (
          fallback &&
          ((isPlaceholderLeadClientName(fallback.client) &&
            resolved.name &&
            !isPlaceholderLeadClientName(resolved.name)) ||
            (!String(fallback.phone_number ?? '').trim() && resolved.phone_number))
        ) {
          void supabase
            .from('leads')
            .update({
              ...(isPlaceholderLeadClientName(fallback.client) && resolved.name
                ? { client: resolved.name }
                : {}),
              ...(!String(fallback.phone_number ?? '').trim() && resolved.phone_number
                ? { phone_number: resolved.phone_number }
                : {}),
              updated_at: new Date().toISOString(),
            })
            .eq('id', leadId)
            .eq('organization_id', organizationId)
            .then(({ error }) => {
              if (error) console.warn('ClientProfile heal lead:', error.message);
            });
        }
      } else {
        setFormData(null);
        setProfile({
          lead_id: leadId,
          name: resolved.name || clientName,
          code: '',
          gender: '' as ClientProfile['gender'],
          age: '',
          occupation: '',
          location: '',
          phone_number: resolved.phone_number,
          email: resolved.email,
        });
      }
    } catch (error) {
      console.error('Error loading client profile:', error);
      if (!silent) {
        toast({
          title: "Error",
          description: "Failed to load client profile",
          variant: "destructive"
        });
      }
    } finally {
      if (!silent) setLoading(false);
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
        if (profile.submissionId) {
          const { error } = await supabase
            .from('whatsapp_conversation_client_profiles')
            .update(payload)
            .eq('id', profile.submissionId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('whatsapp_conversation_client_profiles')
            .insert({ ...payload, organization_id: organizationId })
            .select()
            .single();
          if (error) throw error;
          setProfile(prev => ({ ...prev, submissionId: data.id }));
        }
      } else if (profile.submissionId) {
        await updateLeadSubmissionProfile(profile.submissionId, baseData);
        await supabase
          .from('leads')
          .update({
            client: baseData.name,
            phone_number: baseData.phone_number,
            email: baseData.email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId)
          .eq('organization_id', organizationId);
      } else {
        toast({
          title: "Cannot save",
          description: "No form submission linked to this lead. Profile is view-only.",
          variant: "destructive"
        });
        setSaving(false);
        return;
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

  const showEditButton = canEditSubmission || (isWhatsApp && !isEmail);
  const readOnlyNoSubmission = !isWhatsApp && !isEmail && !canEditSubmission;

  const spacing = "p-4";
  const spaceBetween = "space-y-4";
  const fieldViewClass =
    "flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 min-h-[44px] text-sm text-foreground";
  const sectionLabelClass = "text-xs font-medium uppercase tracking-wider text-muted-foreground";
  const fieldIconClass = "h-4 w-4 shrink-0 text-muted-foreground";

  const formDataEntries = useMemo(() => {
    if (!formData) return [];
    return Object.entries(formData).sort(([a], [b]) => a.localeCompare(b));
  }, [formData]);

  const yesLabel = t('common.yes', { defaultValue: 'Ya' });
  const noLabel = t('common.no', { defaultValue: 'Tidak' });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        hideCloseButton
        className="grid h-[min(92vw,540px,88vh)] w-[min(92vw,540px,88vh)] max-h-[88vh] max-w-[92vw] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden rounded-2xl border border-border bg-white p-0 shadow-lg"
      >
        <div className={`flex-shrink-0 border-b border-border bg-white ${spacing} rounded-t-2xl`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <User className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate text-xl font-semibold text-foreground">
                  Client Profile
                </DialogTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  View and edit client information
                </p>
              </div>
            </div>
            {!isEditing && !loading && showEditButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="shrink-0"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className={`flex flex-col items-center justify-center ${spaceBetween} ${spacing} flex-1 min-h-0`}>
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-muted border-t-primary" aria-hidden />
            <span className="text-sm text-muted-foreground">Loading profile...</span>
          </div>
        ) : (
          <div className={`${spaceBetween} ${spacing} min-h-0 overflow-y-auto seamless-scroll flex-1`}>
            {readOnlyNoSubmission && (
              <p className="text-sm text-amber-700/90 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                No form submission linked to this lead. Showing lead name/phone only; editing is disabled.
              </p>
            )}
            <section className={spaceBetween}>
              <h3 className={sectionLabelClass}>Contact</h3>
              <div className={`rounded-xl border border-border bg-white ${spacing} ${spaceBetween}`}>
                <div className={spaceBetween}>
                  <Label htmlFor="name" className="text-sm font-medium text-foreground">Name *</Label>
                  {isEditing ? (
                    <Input id="name" value={profile.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="Enter client name" className="h-10" />
                  ) : (
                    <div className={fieldViewClass}><User className={fieldIconClass} />{profile.name || '—'}</div>
                  )}
                </div>
                <div className={spaceBetween}>
                  <Label htmlFor="phone_number" className="text-sm font-medium text-foreground">Nomor Telepon</Label>
                  {isEditing ? (
                    <Input id="phone_number" type="tel" value={profile.phone_number} onChange={(e) => handleInputChange('phone_number', e.target.value)} placeholder="Enter phone number" className="h-10" />
                  ) : (
                    <div className={fieldViewClass}><Phone className={fieldIconClass} />{profile.phone_number ? maskPhoneLast4(profile.phone_number) : '—'}</div>
                  )}
                </div>
                <div className={spaceBetween}>
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
                  {isEditing ? (
                    <Input id="email" type="email" value={profile.email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="Enter email" className="h-10" />
                  ) : (
                    <div className={fieldViewClass}><Mail className={fieldIconClass} />{profile.email ? maskEmailForDisplay(profile.email) : '—'}</div>
                  )}
                </div>
              </div>
            </section>

            {!isWhatsApp && !isEmail && (leadMagnetCampaignName || leadMagnetTargetMarket) ? (
              <section className={spaceBetween}>
                <h3 className={sectionLabelClass}>Lead Magnet</h3>
                <div className={`rounded-xl border border-border bg-white ${spacing} ${spaceBetween}`}>
                  <div className={spaceBetween}>
                    <Label className="text-sm font-medium text-foreground">Campaign</Label>
                    <div className={fieldViewClass}>
                      <Megaphone className={fieldIconClass} />
                      {leadMagnetCampaignName || '—'}
                    </div>
                  </div>
                  <div className={spaceBetween}>
                    <Label className="text-sm font-medium text-foreground">Target Market</Label>
                    <div className={fieldViewClass}>
                      <Target className={fieldIconClass} />
                      {leadMagnetTargetMarket || '—'}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className={spaceBetween}>
              <h3 className={sectionLabelClass}>Profile details</h3>
              <div className={`rounded-xl border border-border bg-white ${spacing} ${spaceBetween}`}>
                <div className={spaceBetween}>
                  <Label htmlFor="code" className="text-sm font-medium text-foreground">Code</Label>
                  {isEditing ? (
                    <Input id="code" value={profile.code} onChange={(e) => handleInputChange('code', e.target.value)} placeholder="Client code" className="h-10" />
                  ) : (
                    <div className={fieldViewClass}><Hash className={fieldIconClass} />{profile.code || '—'}</div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className={spaceBetween}>
                    <Label htmlFor="gender" className="text-sm font-medium text-foreground">Gender</Label>
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
                    <Label htmlFor="age" className="text-sm font-medium text-foreground">Age</Label>
                    {isEditing ? (
                      <Input id="age" type="number" value={profile.age} onChange={(e) => handleInputChange('age', e.target.value)} placeholder="Age" min="1" max="149" className="h-10" />
                    ) : (
                      <div className={fieldViewClass}>{profile.age || '—'}</div>
                    )}
                  </div>
                </div>
                <div className={spaceBetween}>
                  <Label htmlFor="occupation" className="text-sm font-medium text-foreground">Occupation</Label>
                  {isEditing ? (
                    <Input id="occupation" value={profile.occupation} onChange={(e) => handleInputChange('occupation', e.target.value)} placeholder="Occupation" className="h-10" />
                  ) : (
                    <div className={fieldViewClass}><Briefcase className={fieldIconClass} />{profile.occupation || '—'}</div>
                  )}
                </div>
                <div className={spaceBetween}>
                  <Label htmlFor="location" className="text-sm font-medium text-foreground">Location</Label>
                  {isEditing ? (
                    <Input id="location" value={profile.location} onChange={(e) => handleInputChange('location', e.target.value)} placeholder="Location" className="h-10" />
                  ) : (
                    <div className={fieldViewClass}><MapPin className={fieldIconClass} />{profile.location || '—'}</div>
                  )}
                </div>
              </div>
            </section>

            {formDataEntries.length > 0 ? (
              <section className={spaceBetween}>
                <h3 className={sectionLabelClass}>
                  {t('omnichannel.leads.clientProfile.formDataTitle')}
                </h3>
                <div className={`rounded-xl border border-border bg-white divide-y divide-border`}>
                  {formDataEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                    >
                      <span className="text-xs font-medium text-muted-foreground sm:max-w-[40%]">
                        {humanizeFormDataKey(key)}
                      </span>
                      <span className="text-sm text-foreground break-words sm:max-w-[58%] sm:text-right">
                        {formatFormDataValue(value, yesLabel, noLabel)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}

        <div className={`flex-shrink-0 border-t border-border bg-white ${spacing} rounded-b-2xl`}>
          <DialogFooter className="flex gap-4">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => { setIsEditing(false); loadClientProfile(); }}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Save</>
                  )}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
                Close
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
