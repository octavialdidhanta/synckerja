import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Plus, Edit, Trash2, Save, X, MoreVertical, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useFamilyMembers, FamilyMember } from '../../hooks/useFamilyMembers';
import { Employee } from '../../hooks/useEmployees';
import { useCurrentOrg } from '../../hooks/useCurrentOrg';

interface FamilyMembersTabProps {
  employee: Employee;
  isEditMode: boolean;
  onUpdate: () => void;
}

export const FamilyMembersTab = ({ employee, isEditMode, onUpdate }: FamilyMembersTabProps) => {
  const { organizationId } = useCurrentOrg();
  const { familyMembers, isLoading, addFamilyMember, updateFamilyMember, deleteFamilyMember } = useFamilyMembers(employee.id);
  
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<FamilyMember>>({
    name: '',
    relationship: '',
    gender: '',
    age: undefined,
    occupation: '',
    address: '',
    phone: '',
    is_emergency_contact: false,
  });

  const relationshipOptions = [
    { value: 'spouse', label: 'Spouse' },
    { value: 'father', label: 'Father' },
    { value: 'mother', label: 'Mother' },
    { value: 'child', label: 'Child' },
    { value: 'sibling', label: 'Sibling' },
    { value: 'other', label: 'Other' },
  ];

  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
  ];

  const handleInputChange = (field: keyof FamilyMember, value: string | boolean | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.relationship) {
      return;
    }

    const familyMemberData = {
      employee_id: employee.id,
      organization_id: organizationId,
      name: formData.name || '',
      relationship: formData.relationship || '',
      gender: formData.gender || '',
      age: formData.age || undefined,
      occupation: formData.occupation || '',
      address: formData.address || '',
      phone: formData.phone || '',
      is_emergency_contact: formData.is_emergency_contact || false,
    };

    if (editingId) {
      await updateFamilyMember.mutateAsync({ id: editingId, data: familyMemberData });
      setEditingId(null);
    } else {
      await addFamilyMember.mutateAsync(familyMemberData);
      setIsAddingNew(false);
    }

    setFormData({
      name: '',
      relationship: '',
      gender: '',
      age: undefined,
      occupation: '',
      address: '',
      phone: '',
      is_emergency_contact: false,
    });
  };

  const handleEdit = (familyMember: FamilyMember) => {
    setEditingId(familyMember.id);
    setFormData({
      name: familyMember.name,
      relationship: familyMember.relationship,
      gender: familyMember.gender || '',
      age: familyMember.age || undefined,
      occupation: familyMember.occupation || '',
      address: familyMember.address || '',
      phone: familyMember.phone || '',
      is_emergency_contact: familyMember.is_emergency_contact || false,
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
      address: '',
      phone: '',
      is_emergency_contact: false,
    });
  };

  const handleDelete = async (id: string) => {
    await deleteFamilyMember.mutateAsync(id);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Family Members</h3>
        </div>
        {isEditMode && (
          <Button
            onClick={() => setIsAddingNew(true)}
            disabled={isAddingNew || editingId !== null}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Family Member
          </Button>
        )}
      </div>

      {(isAddingNew || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? 'Edit Family Member' : 'Add New Family Member'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Full Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship" className="text-sm font-medium">
                  Relationship *
                </Label>
                <Select
                  value={formData.relationship || ''}
                  onValueChange={(value) => handleInputChange('relationship', value)}
                >
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

              <div className="space-y-2">
                <Label htmlFor="gender" className="text-sm font-medium">
                  Gender
                </Label>
                <Select
                  value={formData.gender || ''}
                  onValueChange={(value) => handleInputChange('gender', value)}
                >
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

              <div className="space-y-2">
                <Label htmlFor="age" className="text-sm font-medium">
                  Age
                </Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age || ''}
                  onChange={(e) => handleInputChange('age', parseInt(e.target.value) || undefined)}
                  placeholder="Enter age"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="occupation" className="text-sm font-medium">
                  Occupation
                </Label>
                <Input
                  id="occupation"
                  value={formData.occupation || ''}
                  onChange={(e) => handleInputChange('occupation', e.target.value)}
                  placeholder="Enter occupation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  value={formData.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-medium">
                Address
              </Label>
              <Textarea
                id="address"
                value={formData.address || ''}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Enter address"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_emergency_contact"
                checked={formData.is_emergency_contact || false}
                onCheckedChange={(checked) => handleInputChange('is_emergency_contact', checked as boolean)}
              />
              <Label htmlFor="is_emergency_contact" className="text-sm font-medium">
                Emergency Contact
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button onClick={handleCancel} variant="outline">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Family Records</CardTitle>
        </CardHeader>
        <CardContent>
          {familyMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No family members added yet.</p>
            </div>
          ) : (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name & Relationship</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Birth Date</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Occupation</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Emergency Contact</TableHead>
                    {isEditMode && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {familyMembers.map((familyMember) => (
                    <TableRow key={familyMember.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{familyMember.name}</div>
                          <div className="text-sm text-gray-500 capitalize">{familyMember.relationship}</div>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{familyMember.gender || '-'}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>{familyMember.age || '-'}</TableCell>
                      <TableCell>{familyMember.occupation || '-'}</TableCell>
                      <TableCell>{familyMember.phone || '-'}</TableCell>
                      <TableCell>
                        {familyMember.is_emergency_contact ? (
                          <span className="text-green-600 font-medium">Yes</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </TableCell>
                      {isEditMode && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(familyMember)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(familyMember.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
