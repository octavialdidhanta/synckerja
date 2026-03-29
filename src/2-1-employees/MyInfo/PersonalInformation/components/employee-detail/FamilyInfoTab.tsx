import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { Badge } from '@/shared/components/ui/badge';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { MoreVertical, Plus, Edit, Save, X, Trash2, Upload, Camera } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Employee } from '@/hooks/useEmployees';
import { useFamilyMembers, FamilyMember } from '@/hooks/useFamilyMembers';
import { useShowToast } from '@/shared/hooks/useShowToast';
import { supabase } from '@/shared/lib/supabaseClient';
interface FamilyInfoTabProps {
  employee: Employee;
  isEditMode: boolean;
  onUpdate: () => void;
}
const relationshipOptions = [{
  value: 'spouse',
  label: 'Spouse/Suami/Istri'
}, {
  value: 'child',
  label: 'Child/Anak'
}, {
  value: 'parent',
  label: 'Parent/Orang Tua'
}, {
  value: 'sibling',
  label: 'Sibling/Saudara'
}, {
  value: 'other',
  label: 'Other/Lainnya'
}];
const genderOptions = [{
  value: 'male',
  label: 'Male/Laki-laki'
}, {
  value: 'female',
  label: 'Female/Perempuan'
}];
export const FamilyInfoTab = ({
  employee,
  isEditMode,
  onUpdate
}: FamilyInfoTabProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const showToast = useShowToast();
  const [newMember, setNewMember] = useState<Omit<FamilyMember, 'id' | 'created_at' | 'updated_at' | 'employee_id'>>({
    name: '',
    relationship: '',
    gender: '',
    age: undefined,
    occupation: '',
    phone: '',
    address: '',
    is_emergency_contact: false,
    photo_url: ''
  });
  const {
    familyMembers,
    isLoading,
    addFamilyMember,
    updateFamilyMember,
    deleteFamilyMember
  } = useFamilyMembers(employee.id);
  const handlePhotoUpload = async (memberId: string, file: File) => {
    try {
      setUploadingPhoto(memberId);

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `family-member-${memberId}-${Date.now()}.${fileExt}`;
      const filePath = `${employee.id}/family-photos/${fileName}`;
      console.log('Uploading family member photo to path:', filePath);
      const {
        data,
        error
      } = await supabase.storage.from('employee-documents').upload(filePath, file, {
        upsert: true
      });
      if (error) {
        console.error('Storage upload error:', error);
        throw error;
      }
      console.log('Photo upload successful:', data);

      // Update family member with photo URL
      await updateFamilyMember.mutateAsync({
        id: memberId,
        data: {
          photo_url: data.path
        }
      });
      showToast({
        title: 'Success',
        description: 'Photo uploaded successfully'
      });
    } catch (error) {
      console.error('Photo upload error:', error);
      showToast({
        title: 'Error',
        description: 'Failed to upload photo',
        variant: 'destructive'
      });
    } finally {
      setUploadingPhoto(null);
    }
  };
  const handlePhotoDelete = async (memberId: string, photoUrl: string) => {
    try {
      // Delete from storage
      await supabase.storage.from('employee-documents').remove([photoUrl]);

      // Update family member record
      await updateFamilyMember.mutateAsync({
        id: memberId,
        data: {
          photo_url: null
        }
      });
      showToast({
        title: 'Success',
        description: 'Photo deleted successfully'
      });
    } catch (error) {
      console.error('Photo delete error:', error);
      showToast({
        title: 'Error',
        description: 'Failed to delete photo',
        variant: 'destructive'
      });
    }
  };
  const triggerPhotoUpload = (memberId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handlePhotoUpload(memberId, file);
      }
    };
    input.click();
  };
  const getPhotoUrl = async (photoUrl: string) => {
    if (!photoUrl) return null;
    try {
      const {
        data
      } = await supabase.storage.from('employee-documents').createSignedUrl(photoUrl, 3600);
      return data?.signedUrl || null;
    } catch (error) {
      console.error('Error getting photo URL:', error);
      return null;
    }
  };
  const handleAddMember = async () => {
    if (!newMember.name || !newMember.relationship) {
      showToast({
        title: 'Validation Error',
        description: 'Name and relationship are required.',
        variant: 'destructive'
      });
      return;
    }
    try {
      setIsSaving(true);
      console.log('Adding new family member:', newMember);
      await addFamilyMember.mutateAsync({
        ...newMember,
        employee_id: employee.id,
        organization_id: employee.organization_id
      });
      console.log('Family member added successfully');

      // Reset form
      setNewMember({
        name: '',
        relationship: '',
        gender: '',
        age: undefined,
        occupation: '',
        phone: '',
        address: '',
        is_emergency_contact: false,
        photo_url: ''
      });
      setIsAddingNew(false);
      onUpdate();
      showToast({
        title: 'Success',
        description: 'Family member added successfully.'
      });
    } catch (error) {
      console.error('Error adding family member:', error);
      showToast({
        title: 'Error',
        description: 'Failed to add family member. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };
  const handleUpdateMember = async (id: string, data: Partial<FamilyMember>) => {
    try {
      await updateFamilyMember.mutateAsync({
        id,
        data
      });
      setEditingId(null);
      onUpdate();
    } catch (error) {
      console.error('Error updating family member:', error);
    }
  };
  const handleDeleteMember = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this family member?')) {
      try {
        await deleteFamilyMember.mutateAsync(id);
        onUpdate();
      } catch (error) {
        console.error('Error deleting family member:', error);
      }
    }
  };
  if (isLoading) {
    return <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>;
  }
  const getRelationshipLabel = (value: string) => {
    const option = relationshipOptions.find(opt => opt.value === value);
    return option ? option.label : value;
  };
  const getGenderLabel = (value: string) => {
    const option = genderOptions.find(opt => opt.value === value);
    return option ? option.label : value;
  };
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Family Members</h3>
        {isEditMode && <Button onClick={() => setIsAddingNew(true)} className="bg-blue-600 hover:bg-blue-700 text-white" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Family Member
          </Button>}
      </div>

      {/* Add New Member Form */}
      {isAddingNew && isEditMode && <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Name *</Label>
                <Input id="new-name" value={newMember.name} onChange={e => setNewMember(prev => ({
              ...prev,
              name: e.target.value
            }))} placeholder="Enter full name" disabled={isSaving} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-relationship">Relationship *</Label>
                <Select value={newMember.relationship} onValueChange={value => setNewMember(prev => ({
              ...prev,
              relationship: value
            }))} disabled={isSaving}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationshipOptions.map(option => <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-gender">Gender</Label>
                <Select value={newMember.gender} onValueChange={value => setNewMember(prev => ({
              ...prev,
              gender: value
            }))} disabled={isSaving}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {genderOptions.map(option => <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-age">Age</Label>
                <Input id="new-age" type="number" value={newMember.age || ''} onChange={e => setNewMember(prev => ({
              ...prev,
              age: e.target.value ? parseInt(e.target.value) : undefined
            }))} placeholder="Enter age" disabled={isSaving} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-occupation">Occupation</Label>
                <Input id="new-occupation" value={newMember.occupation} onChange={e => setNewMember(prev => ({
              ...prev,
              occupation: e.target.value
            }))} placeholder="Enter occupation" disabled={isSaving} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-phone">Phone Number</Label>
                <Input id="new-phone" value={newMember.phone} onChange={e => setNewMember(prev => ({
              ...prev,
              phone: e.target.value
            }))} placeholder="Enter phone number" disabled={isSaving} />
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <Label htmlFor="new-address">Address</Label>
              <Input id="new-address" value={newMember.address} onChange={e => setNewMember(prev => ({
            ...prev,
            address: e.target.value
          }))} placeholder="Enter address" disabled={isSaving} />
            </div>

            <div className="flex items-center space-x-2 mb-4">
              <Switch id="new-emergency" checked={newMember.is_emergency_contact} onCheckedChange={checked => setNewMember(prev => ({
            ...prev,
            is_emergency_contact: checked
          }))} disabled={isSaving} />
              <Label htmlFor="new-emergency">Emergency Contact</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
            setIsAddingNew(false);
            setNewMember({
              name: '',
              relationship: '',
              gender: '',
              age: undefined,
              occupation: '',
              phone: '',
              address: '',
              is_emergency_contact: false,
              photo_url: ''
            });
          }} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleAddMember} className="bg-green-600 hover:bg-green-700" disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Member'}
              </Button>
            </div>
          </CardContent>
        </Card>}

      {/* Family Members List */}
      {familyMembers && familyMembers.length > 0 ? <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Family Members List</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] w-full">
              <div className="space-y-0">
                {familyMembers.map((member, index) => <div key={member.id}>
                    <FamilyMemberListItem member={member} isEditMode={isEditMode} isEditing={editingId === member.id} uploadingPhoto={uploadingPhoto === member.id} onEdit={() => setEditingId(member.id)} onCancelEdit={() => setEditingId(null)} onUpdate={data => handleUpdateMember(member.id, data)} onDelete={() => handleDeleteMember(member.id)} onPhotoUpload={file => handlePhotoUpload(member.id, file)} onPhotoDelete={() => member.photo_url && handlePhotoDelete(member.id, member.photo_url)} onTriggerPhotoUpload={() => triggerPhotoUpload(member.id)} getRelationshipLabel={getRelationshipLabel} getGenderLabel={getGenderLabel} getPhotoUrl={getPhotoUrl} />
                    {index < familyMembers.length - 1 && <div className="border-b border-gray-200"></div>}
                  </div>)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card> : <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p>No family members added yet.</p>
          {isEditMode && <p className="text-sm mt-2">Click "Add Family Member" to get started.</p>}
        </div>}
    </div>;
};
interface FamilyMemberListItemProps {
  member: FamilyMember;
  isEditMode: boolean;
  isEditing: boolean;
  uploadingPhoto: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (data: Partial<FamilyMember>) => void;
  onDelete: () => void;
  onPhotoUpload: (file: File) => void;
  onPhotoDelete: () => void;
  onTriggerPhotoUpload: () => void;
  getRelationshipLabel: (value: string) => string;
  getGenderLabel: (value: string) => string;
  getPhotoUrl: (url: string) => Promise<string | null>;
}
const FamilyMemberListItem = ({
  member,
  isEditMode,
  isEditing,
  uploadingPhoto,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  onPhotoUpload,
  onPhotoDelete,
  onTriggerPhotoUpload,
  getRelationshipLabel,
  getGenderLabel,
  getPhotoUrl
}: FamilyMemberListItemProps) => {
  const [editData, setEditData] = useState<Partial<FamilyMember>>({
    name: member.name || '',
    relationship: member.relationship || '',
    gender: member.gender || '',
    age: member.age || undefined,
    occupation: member.occupation || '',
    phone: member.phone || '',
    address: member.address || '',
    is_emergency_contact: member.is_emergency_contact || false,
    photo_url: member.photo_url || ''
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    const loadPhotoUrl = async () => {
      if (member.photo_url) {
        const url = await getPhotoUrl(member.photo_url);
        setPhotoUrl(url);
      }
    };
    loadPhotoUrl();
  }, [member.photo_url, getPhotoUrl]);
  const handleSave = () => {
    onUpdate(editData);
  };
  if (isEditing) {
    return <div className="p-4 bg-blue-50 border-blue-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={editData.name} onChange={e => setEditData(prev => ({
            ...prev,
            name: e.target.value
          }))} />
          </div>
          <div className="space-y-2">
            <Label>Relationship *</Label>
            <Select value={editData.relationship} onValueChange={value => setEditData(prev => ({
            ...prev,
            relationship: value
          }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {relationshipOptions.map(option => <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Gender</Label>
            <Select value={editData.gender} onValueChange={value => setEditData(prev => ({
            ...prev,
            gender: value
          }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {genderOptions.map(option => <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Age</Label>
            <Input type="number" value={editData.age || ''} onChange={e => setEditData(prev => ({
            ...prev,
            age: e.target.value ? parseInt(e.target.value) : undefined
          }))} />
          </div>
          <div className="space-y-2">
            <Label>Occupation</Label>
            <Input value={editData.occupation} onChange={e => setEditData(prev => ({
            ...prev,
            occupation: e.target.value
          }))} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={editData.phone} onChange={e => setEditData(prev => ({
            ...prev,
            phone: e.target.value
          }))} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Address</Label>
            <Input value={editData.address} onChange={e => setEditData(prev => ({
            ...prev,
            address: e.target.value
          }))} />
          </div>
        </div>
        
        <div className="flex items-center space-x-2 mb-4">
          <Switch checked={editData.is_emergency_contact} onCheckedChange={checked => setEditData(prev => ({
          ...prev,
          is_emergency_contact: checked
        }))} />
          <Label>Emergency Contact</Label>
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button size="sm" variant="outline" onClick={onCancelEdit}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>;
  }
  return <div className="p-4 hover:bg-gray-50">
      <div className="flex items-center w-full">
        {/* Photo */}
        <div className="flex-shrink-0 relative mr-4">
          <Avatar className="h-12 w-12">
            {photoUrl ? <AvatarImage src={photoUrl} alt={member.name} /> : <AvatarFallback className="bg-blue-100 text-blue-600">
                {member.name ? member.name.charAt(0).toUpperCase() : 'F'}
              </AvatarFallback>}
          </Avatar>
          {isEditMode && <div className="absolute -bottom-1 -right-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-6 w-6 p-0 rounded-full bg-white border shadow-sm" disabled={uploadingPhoto}>
                    {uploadingPhoto ? <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-500"></div> : <Camera className="h-3 w-3" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border shadow-lg">
                  <DropdownMenuItem onClick={onTriggerPhotoUpload} className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </DropdownMenuItem>
                  {member.photo_url && <DropdownMenuItem onClick={onPhotoDelete} className="text-red-600 cursor-pointer">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Photo
                    </DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>}
        </div>
        
        {/* Name and Details in full width */}
        <div className="flex-1 min-w-0 mr-4">
          <div className="flex items-center justify-between w-full">
            {/* Left side: Name and badges */}
            <div className="flex-shrink-0">
              <h4 className="font-semibold text-gray-900 text-sm">{member.name}</h4>
              <div className="flex flex-col space-y-1 mt-1">
                
                {member.is_emergency_contact && <Badge variant="destructive" className="text-xs w-fit">
                    Emergency Contact
                  </Badge>}
              </div>
            </div>
            
            {/* Right side: Details in horizontal layout using full remaining width */}
            <div className="flex-1 min-w-0 ml-6">
              <div className="grid grid-cols-5 gap-4 w-full">
                {/* Gender */}
                {member.gender && <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-600">Gender</div>
                    <div className="text-sm text-gray-900 truncate">{getGenderLabel(member.gender)}</div>
                  </div>}
                
                {/* Age */}
                {member.age && <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-600">Age</div>
                    <div className="text-sm text-gray-900">{member.age} years</div>
                  </div>}
                
                {/* Occupation */}
                {member.occupation && <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-600">Occupation</div>
                    <div className="text-sm text-gray-900 truncate" title={member.occupation}>{member.occupation}</div>
                  </div>}
                
                {/* Phone */}
                {member.phone && <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-600">Phone</div>
                    <div className="text-sm text-gray-900 truncate">{member.phone}</div>
                  </div>}
                
                {/* Address */}
                {member.address && <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-600">Address</div>
                    <div className="text-sm text-gray-900 truncate" title={member.address}>{member.address}</div>
                  </div>}
              </div>
            </div>
          </div>
        </div>
        
        {/* Action menu */}
        {isEditMode && <div className="flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white border shadow-lg">
                <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-red-600 cursor-pointer">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>}
      </div>
    </div>;
};
