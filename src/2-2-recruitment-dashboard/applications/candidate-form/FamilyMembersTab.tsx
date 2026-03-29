
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Plus, Edit, Trash2, Save, X, MoreVertical } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';

interface FamilyMember {
  id: string;
  candidate_profile_id: string;
  name: string;
  relationship: string;
  gender?: string;
  age?: number;
  occupation?: string;
  phone?: string;
  address?: string;
  is_emergency_contact: boolean;
  created_at: string;
  updated_at: string;
}

interface FamilyMembersTabProps {
  candidateProfileId: string;
  onFamilyMembersChange?: () => void;
  isReadOnly?: boolean;
}

const relationshipOptions = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'other', label: 'Other' },
];

const genderOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export const FamilyMembersTab = ({ candidateProfileId, onFamilyMembersChange, isReadOnly = false }: FamilyMembersTabProps) => {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<FamilyMember>>({
    name: '',
    relationship: '',
    gender: '',
    age: undefined,
    occupation: '',
    phone: '',
    address: '',
    is_emergency_contact: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchFamilyMembers();
  }, [candidateProfileId]);

  const fetchFamilyMembers = async () => {
    try {
      console.log('Fetching family members for candidate:', candidateProfileId);
      
      const { data, error } = await supabase
        .from('candidate_family_members')
        .select('*')
        .eq('candidate_profile_id', candidateProfileId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching family members:', error);
        throw error;
      }

      console.log('Family members fetched:', data);
      setFamilyMembers(data as FamilyMember[] || []);
      
      // Notify parent component about family members change
      if (onFamilyMembersChange) {
        onFamilyMembersChange();
      }
    } catch (error: any) {
      console.error('Error fetching family members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load family members.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof FamilyMember, value: string | boolean | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.relationship) {
      toast({
        title: 'Validation Error',
        description: 'Name and relationship are required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const memberData = {
        candidate_profile_id: candidateProfileId,
        name: formData.name || '',
        relationship: formData.relationship || '',
        gender: formData.gender || null,
        age: formData.age || null,
        occupation: formData.occupation || null,
        phone: formData.phone || null,
        address: formData.address || null,
        is_emergency_contact: formData.is_emergency_contact || false,
      };

      if (editingId) {
        const { error } = await supabase
          .from('candidate_family_members')
          .update(memberData)
          .eq('id', editingId);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Family member updated successfully.',
        });
      } else {
        const { error } = await supabase
          .from('candidate_family_members')
          .insert(memberData);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Family member added successfully.',
        });
      }

      await fetchFamilyMembers();
      handleCancel();
    } catch (error: any) {
      console.error('Error saving family member:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save family member.',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (member: FamilyMember) => {
    setEditingId(member.id);
    setFormData({
      name: member.name,
      relationship: member.relationship,
      gender: member.gender || '',
      age: member.age || undefined,
      occupation: member.occupation || '',
      phone: member.phone || '',
      address: member.address || '',
      is_emergency_contact: member.is_emergency_contact || false,
    });
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setFormData({
      name: '',
      relationship: '',
      gender: '',
      age: undefined,
      occupation: '',
      phone: '',
      address: '',
      is_emergency_contact: false,
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this family member record?')) {
      try {
        const { error } = await supabase
          .from('candidate_family_members')
          .delete()
          .eq('id', id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Family member deleted successfully.',
        });

        await fetchFamilyMembers();
      } catch (error: any) {
        console.error('Error deleting family member:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to delete family member.',
          variant: 'destructive',
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 max-h-[calc(100vh-120px)]">
      <div className="space-y-6 seamless-scroll overflow-y-auto flex-1">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">Family Members</CardTitle>
              {!isReadOnly && !isAddingNew && !editingId && (
                <Button
                  onClick={() => setIsAddingNew(true)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Family Member
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
          {/* Add New Family Member Form */}
          {isAddingNew && (
            <Card className="border-2 border-blue-200 bg-blue-50 mb-6">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name || ''}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="relationship">Relationship *</Label>
                    <Select value={formData.relationship || ''} onValueChange={(value) => handleInputChange('relationship', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        {relationshipOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={formData.gender || ''} onValueChange={(value) => handleInputChange('gender', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {genderOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      value={formData.age || ''}
                      onChange={(e) => handleInputChange('age', parseInt(e.target.value) || undefined)}
                      placeholder="Enter age"
                    />
                  </div>
                  <div>
                    <Label htmlFor="occupation">Occupation</Label>
                    <Input
                      id="occupation"
                      value={formData.occupation || ''}
                      onChange={(e) => handleInputChange('occupation', e.target.value)}
                      placeholder="Enter occupation"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={formData.phone || ''}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Enter address"
                  />
                </div>
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="is-emergency-contact"
                    checked={formData.is_emergency_contact || false}
                    onCheckedChange={(checked) => handleInputChange('is_emergency_contact', checked as boolean)}
                  />
                  <Label htmlFor="is-emergency-contact" className="text-sm">Emergency Contact</Label>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={handleCancel}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                    <Save className="h-4 w-4 mr-2" />
                    Save Member
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Family Members Records Table */}
          {familyMembers && familyMembers.length > 0 ? (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name & Relationship</TableHead>
                    <TableHead className="w-[100px]">Gender</TableHead>
                    <TableHead className="w-[80px]">Age</TableHead>
                    <TableHead className="w-[150px]">Occupation</TableHead>
                    <TableHead className="w-[120px]">Phone</TableHead>
                    <TableHead className="w-[200px]">Address</TableHead>
                    <TableHead className="w-[80px]">Emergency</TableHead>
                    {!isReadOnly && <TableHead className="w-[50px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {familyMembers.map((member) => (
                    <TableRow key={member.id}>
                      {editingId === member.id ? (
                        <>
                          <TableCell className="p-2">
                            <div className="space-y-2">
                              <Input
                                value={formData.name || ''}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder="Name"
                                className="text-sm"
                              />
                              <Select value={formData.relationship || ''} onValueChange={(value) => handleInputChange('relationship', value)}>
                                <SelectTrigger className="text-sm">
                                  <SelectValue placeholder="Relationship" />
                                </SelectTrigger>
                                <SelectContent>
                                  {relationshipOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <Select value={formData.gender || ''} onValueChange={(value) => handleInputChange('gender', value)}>
                              <SelectTrigger className="text-sm">
                                <SelectValue placeholder="Gender" />
                              </SelectTrigger>
                              <SelectContent>
                                {genderOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              value={formData.age || ''}
                              onChange={(e) => handleInputChange('age', parseInt(e.target.value) || undefined)}
                              placeholder="Age"
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={formData.occupation || ''}
                              onChange={(e) => handleInputChange('occupation', e.target.value)}
                              placeholder="Occupation"
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={formData.phone || ''}
                              onChange={(e) => handleInputChange('phone', e.target.value)}
                              placeholder="Phone"
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={formData.address || ''}
                              onChange={(e) => handleInputChange('address', e.target.value)}
                              placeholder="Address"
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Checkbox
                              checked={formData.is_emergency_contact || false}
                              onCheckedChange={(checked) => handleInputChange('is_emergency_contact', checked as boolean)}
                            />
                          </TableCell>
                          {!isReadOnly && (
                            <TableCell className="p-2">
                              <div className="flex space-x-1">
                                <Button size="sm" variant="outline" onClick={handleCancel} className="h-6 w-6 p-0">
                                  <X className="h-3 w-3" />
                                </Button>
                                <Button size="sm" onClick={handleSave} className="h-6 w-6 p-0 bg-green-600 hover:bg-green-700">
                                  <Save className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <div>
                              <div className="font-semibold text-sm">{member.name}</div>
                              <div className="text-sm text-gray-600 capitalize">{member.relationship}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm capitalize">{member.gender || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{member.age || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{member.occupation || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{member.phone || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm" title={member.address || ''}>
                              {member.address ? 
                                (member.address.length > 30 ? 
                                  member.address.substring(0, 30) + '...' : 
                                  member.address
                                ) : '-'
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              {member.is_emergency_contact ? '✓' : '-'}
                            </div>
                          </TableCell>
                          {!isReadOnly && (
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-white border shadow-lg">
                                  <DropdownMenuItem onClick={() => handleEdit(member)} className="cursor-pointer">
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDelete(member.id)} className="text-red-600 cursor-pointer">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p>No family member records found.</p>
              <p className="text-sm mt-2">Click "Add Family Member" to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
};
