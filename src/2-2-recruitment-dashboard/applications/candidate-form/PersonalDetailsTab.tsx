
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { User, ChevronRight, Upload, Camera, Edit, Save, X } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface PersonalDetailsTabProps {
  candidate: any;
  onUpdate: (data: any) => void;
  isReadOnly?: boolean;
}

export const PersonalDetailsTab = ({
  candidate,
  onUpdate,
  isReadOnly = false
}: PersonalDetailsTabProps) => {
  const [formData, setFormData] = useState({
    full_name: candidate?.full_name || '',
    email: candidate?.email || '',
    mobile_phone: candidate?.mobile_phone || '',
    birth_date: candidate?.birth_date || '',
    birth_place: candidate?.birth_place || '',
    gender: candidate?.gender || '',
    nik: candidate?.nik || '',
    religion: candidate?.religion || '',
    marital_status: candidate?.marital_status || '',
    nationality: candidate?.nationality || 'Indonesian',
    blood_type: candidate?.blood_type || '',
    photo_url: candidate?.photo_url || ''
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Check if profile is incomplete to auto-enable editing
  const isProfileIncomplete = () => {
    const requiredFields = [
      'full_name', 'email', 'mobile_phone', 'birth_date', 'birth_place', 
      'gender', 'nik', 'religion', 'marital_status', 'nationality', 'blood_type', 'photo_url'
    ];
    return requiredFields.some(field => !candidate?.[field] || candidate[field].toString().trim() === '');
  };
  
  const [isEditing, setIsEditing] = useState(() => {
    // Start in editing mode if profile is incomplete and not read-only
    return !isReadOnly && isProfileIncomplete();
  });
  const { toast } = useToast();
  const { t } = useAppTranslation();

  // Auto-save when formData changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (candidate?.id && !isReadOnly && isEditing) {
        handleAutoSave();
      }
    }, 1000); // Save after 1 second of no changes

    return () => clearTimeout(timeoutId);
  }, [formData, candidate?.id, isReadOnly, isEditing]);

  // Update editing state when candidate data changes
  useEffect(() => {
    const incomplete = isProfileIncomplete();
    console.log('🔍 Profile incomplete check:', { incomplete, candidateId: candidate?.id, currentData: candidate });
    if (!isReadOnly && incomplete) {
      setIsEditing(true);
    }
  }, [candidate, isReadOnly]);

  const handleAutoSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      console.log('🔄 Auto-saving personal details:', formData);
      await onUpdate(formData);
      console.log('✅ Personal details auto-saved successfully');
    } catch (error) {
      console.error('❌ Auto-save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (!isEditing && !isReadOnly) {
      // Auto-enable editing if user starts typing and profile is incomplete
      if (isProfileIncomplete()) {
        setIsEditing(true);
      }
    }
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(formData);
      setIsEditing(false);
      toast({
        title: "Success",
        description: t('candidateProfile.personal.toastSuccess', 'Personal details updated successfully')
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: t('candidateProfile.personal.toastError', 'Failed to save changes'),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    setFormData({
      full_name: candidate?.full_name || '',
      email: candidate?.email || '',
      mobile_phone: candidate?.mobile_phone || '',
      birth_date: candidate?.birth_date || '',
      birth_place: candidate?.birth_place || '',
      gender: candidate?.gender || '',
      nik: candidate?.nik || '',
      religion: candidate?.religion || '',
      marital_status: candidate?.marital_status || '',
      nationality: candidate?.nationality || 'Indonesian',
      blood_type: candidate?.blood_type || '',
      photo_url: candidate?.photo_url || ''
    });
    setIsEditing(false);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !candidate?.id) return;

    setUploading(true);
    try {
      // Upload to recruitment bucket
      const fileExt = file.name.split('.').pop();
      const fileName = `${candidate.id}/avatar.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('recruitment-files')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('recruitment-files')
        .getPublicUrl(fileName);
      
      const photoUrl = data.publicUrl;

      // Update form data and save
      const updatedData = { ...formData, photo_url: photoUrl };
      setFormData(updatedData);
      await onUpdate(updatedData);

      toast({
        title: "Success",
        description: "Photo uploaded successfully"
      });
    } catch (error) {
      console.error('Photo upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload photo",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'CN';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const requiredFields = ['full_name', 'email', 'mobile_phone', 'birth_date', 'birth_place', 'gender', 'nik', 'religion', 'marital_status', 'nationality', 'blood_type', 'photo_url'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>{t('candidateProfile.personal.sectionTitle', 'Personal Information')}</span>
            {saving && <span className="text-sm text-gray-500">Saving...</span>}
          </div>
          <div className="flex items-center space-x-2">
            {!isReadOnly && (
              <>
                {!isEditing ? (
                  <Button onClick={handleEdit} size="sm" variant="outline">
                    <Edit className="h-4 w-4 mr-1" />
                    {t('common.edit', 'Edit')}
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Button onClick={handleCancel} size="sm" variant="outline">
                      <X className="h-4 w-4 mr-1" />
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button onClick={handleSave} size="sm" disabled={saving}>
                      <Save className="h-4 w-4 mr-1" />
                      {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Upload Section */}
        <div className="flex flex-col items-center space-y-4">
          <Avatar className="w-24 h-24">
            <AvatarImage src={formData.photo_url} alt={formData.full_name} />
            <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-lg">
              {getInitials(formData.full_name)}
            </AvatarFallback>
          </Avatar>
          
          {!isReadOnly && (
            <div className="flex flex-col items-center space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                id="photo-upload"
                disabled={uploading}
              />
              <label htmlFor="photo-upload">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  className="cursor-pointer"
                  asChild
                >
                  <span>
                    {uploading ? (
                      <>
                        <Upload className="h-4 w-4 mr-2 animate-spin" />
                        {t('candidateProfile.personal.uploading', 'Uploading...')}
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4 mr-2" />
                        {t('candidateProfile.personal.uploadPhoto', 'Upload Photo')}
                      </>
                    )}
                  </span>
                </Button>
              </label>
              <p className="text-xs text-gray-500 text-center">
                <span className="text-red-500">*</span> {t('candidateProfile.personal.photoRequired', 'Profile photo is required')}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">
              {t('candidateProfile.personal.fullName', 'Full Name')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleInputChange('full_name', e.target.value)}
              disabled={!isEditing}
              required
              placeholder={t('candidateProfile.personal.placeholderFullName', 'Enter your full name')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              {t('candidateProfile.personal.email', 'Email')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled={!isEditing}
              required
              placeholder="nama@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile_phone">
              {t('candidateProfile.personal.phone', 'Phone Number')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="mobile_phone"
              value={formData.mobile_phone}
              onChange={(e) => handleInputChange('mobile_phone', e.target.value)}
              disabled={!isEditing}
              required
              placeholder="08xxxxxxxxx"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birth_date">
              {t('candidateProfile.personal.birthDate', 'Date of Birth')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="birth_date"
              type="date"
              value={formData.birth_date}
              onChange={(e) => handleInputChange('birth_date', e.target.value)}
              disabled={!isEditing}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birth_place">
              {t('candidateProfile.personal.birthPlace', 'Place of Birth')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="birth_place"
              value={formData.birth_place}
              onChange={(e) => handleInputChange('birth_place', e.target.value)}
              disabled={!isEditing}
              required
              placeholder={t('candidateProfile.personal.placeholderBirthPlace', 'Enter place of birth')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">
              {t('candidateProfile.personal.gender', 'Gender')} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.gender}
              onValueChange={(value) => handleInputChange('gender', value)}
              disabled={!isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('candidateProfile.personal.placeholderGender', 'Select gender')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t('candidateProfile.personal.genderMale', 'Male')}</SelectItem>
                <SelectItem value="female">{t('candidateProfile.personal.genderFemale', 'Female')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nik">
              {t('candidateProfile.personal.nik', 'NIK')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nik"
              value={formData.nik}
              onChange={(e) => handleInputChange('nik', e.target.value)}
              disabled={!isEditing}
              required
              placeholder={t('candidateProfile.personal.placeholderNik', '16 digit NIK')}
              maxLength={16}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="religion">
              {t('candidateProfile.personal.religion', 'Religion')} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.religion}
              onValueChange={(value) => handleInputChange('religion', value)}
              disabled={!isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('candidateProfile.personal.placeholderReligion', 'Select religion')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="islam">{t('candidateProfile.personal.religionIslam', 'Islam')}</SelectItem>
                <SelectItem value="christian">{t('candidateProfile.personal.religionChristian', 'Christian')}</SelectItem>
                <SelectItem value="catholic">{t('candidateProfile.personal.religionCatholic', 'Catholic')}</SelectItem>
                <SelectItem value="hindu">{t('candidateProfile.personal.religionHindu', 'Hindu')}</SelectItem>
                <SelectItem value="buddha">{t('candidateProfile.personal.religionBuddha', 'Buddha')}</SelectItem>
                <SelectItem value="konghucu">{t('candidateProfile.personal.religionKonghucu', 'Confucianism')}</SelectItem>
                <SelectItem value="other">{t('candidateProfile.personal.religionOther', 'Other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="marital_status">
              {t('candidateProfile.personal.maritalStatus', 'Marital Status')} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.marital_status}
              onValueChange={(value) => handleInputChange('marital_status', value)}
              disabled={!isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('candidateProfile.personal.placeholderMaritalStatus', 'Select marital status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">{t('candidateProfile.personal.maritalSingle', 'Single')}</SelectItem>
                <SelectItem value="married">{t('candidateProfile.personal.maritalMarried', 'Married')}</SelectItem>
                <SelectItem value="divorced">{t('candidateProfile.personal.maritalDivorced', 'Divorced')}</SelectItem>
                <SelectItem value="widowed">{t('candidateProfile.personal.maritalWidowed', 'Widowed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nationality">
              {t('candidateProfile.personal.nationality', 'Nationality')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nationality"
              value={formData.nationality}
              onChange={(e) => handleInputChange('nationality', e.target.value)}
              disabled={!isEditing}
              placeholder="Indonesian"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="blood_type">
              {t('candidateProfile.personal.bloodType', 'Blood Type')} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.blood_type}
              onValueChange={(value) => handleInputChange('blood_type', value)}
              disabled={!isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('candidateProfile.personal.placeholderBloodType', 'Select blood type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="B">B</SelectItem>
                <SelectItem value="AB">AB</SelectItem>
                <SelectItem value="O">O</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="text-red-500">*</span> {t('candidateProfile.personal.requiredNotice', 'All fields are required to complete your profile. Profile photo must also be uploaded.')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
