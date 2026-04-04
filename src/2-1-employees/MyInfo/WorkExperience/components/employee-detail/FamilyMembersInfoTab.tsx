import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Plus, Edit, Trash2, Save, X, MoreVertical, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useFamilyMembers, FamilyMember } from '@/shared/hooks/employees/useFamilyMembers';
import { Employee } from '@/shared/hooks/employees/useEmployees';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

interface FamilyMembersInfoTabProps {
  employee: Employee;
  isEditMode: boolean;
  onUpdate: () => void;
}

export const FamilyMembersInfoTab = ({ employee, isEditMode, onUpdate }: FamilyMembersInfoTabProps) => {
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

  const handleInputChange = (field: keyof FamilyMember, value: string | boolean | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-calculate age when birth_date changes - Note: no birth_date field in database
    // if (field === 'birth_date' && value) {
    //   const birthDate = new Date(value as string);
    //   const today = new Date();
    //   const age = today.getFullYear() - birthDate.getFullYear();
    //   const monthDiff = today.getMonth() - birthDate.getMonth();
    //   
    //   if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    //     age--;
    //   }
    //   
    //   setFormData(prev => ({
    //     ...prev,
    //     age: age
    //   }));
    // }
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
      is_emergency_contact: familyMember.is_emergency_contact,
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
    if (window.confirm('Are you sure you want to delete this family member record?')) {
      await deleteFamilyMember.mutateAsync(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Family Members Information</h3>
        {isEditMode && !isAddingNew && !editingId && (
          <Button
            onClick={() => setIsAddingNew(true)}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Family Member
          </Button>
        )}
      </div>

      {/* Add New Family Member Form */}
      {isAddingNew && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter name"
                />
              </div>
              <div>
                <Label htmlFor="relationship">Relationship *</Label>
                <Select
                  value={formData.relationship || ''}
                  onValueChange={(value) => handleInputChange('relationship', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spouse">Spouse</SelectItem>
                    <SelectItem value="child">Child</SelectItem>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="sibling">Sibling</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={formData.gender || ''}
                  onValueChange={(value) => handleInputChange('gender', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age || ''}
                  onChange={(e) => handleInputChange('age', parseInt(e.target.value) || 0)}
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
              <Textarea
                id="address"
                value={formData.address || ''}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Enter address"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2 mb-4">
              <Checkbox
                id="emergency"
                checked={formData.is_emergency_contact || false}
                onCheckedChange={(checked) => handleInputChange('is_emergency_contact', checked as boolean)}
              />
              <Label htmlFor="emergency">Emergency Contact</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Family Members Records Table */}
      {familyMembers && familyMembers.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Family Members Records</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name & Relationship</TableHead>
                    <TableHead className="w-[100px]">Gender</TableHead>
                    <TableHead className="w-[80px]">Age</TableHead>
                    <TableHead className="w-[150px]">Occupation</TableHead>
                    <TableHead className="w-[120px]">Phone</TableHead>
                    <TableHead className="w-[200px]">Address</TableHead>
                    <TableHead className="w-[100px]">Emergency</TableHead>
                    {isEditMode && <TableHead className="w-[50px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {familyMembers.map((familyMember) => (
                    <TableRow key={familyMember.id}>
                      {editingId === familyMember.id ? (
                        <>
                          <TableCell className="p-2">
                            <div className="space-y-2">
                              <Input
                                value={formData.name || ''}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder="Name"
                                className="text-sm"
                              />
                              <Select
                                value={formData.relationship || ''}
                                onValueChange={(value) => handleInputChange('relationship', value)}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="spouse">Spouse</SelectItem>
                                  <SelectItem value="child">Child</SelectItem>
                                  <SelectItem value="parent">Parent</SelectItem>
                                  <SelectItem value="sibling">Sibling</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <Select
                              value={formData.gender || ''}
                              onValueChange={(value) => handleInputChange('gender', value)}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              value={formData.age || ''}
                              onChange={(e) => handleInputChange('age', parseInt(e.target.value) || 0)}
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
                            <Textarea
                              value={formData.address || ''}
                              onChange={(e) => handleInputChange('address', e.target.value)}
                              placeholder="Address"
                              rows={2}
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={formData.is_emergency_contact || false}
                                onCheckedChange={(checked) => handleInputChange('is_emergency_contact', checked as boolean)}
                              />
                              <span className="text-xs">Emergency</span>
                            </div>
                          </TableCell>
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
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <div>
                              <div className="font-semibold text-sm">{familyMember.name}</div>
                              <div className="text-sm text-gray-600 capitalize">{familyMember.relationship}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm capitalize">{familyMember.gender || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{familyMember.age || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{familyMember.occupation || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{familyMember.phone || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm" title={familyMember.address || ''}>
                              {familyMember.address ? 
                                (familyMember.address.length > 50 ? 
                                  familyMember.address.substring(0, 50) + '...' : 
                                  familyMember.address
                                ) : '-'
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              {familyMember.is_emergency_contact ? (
                                <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full">Emergency</span>
                              ) : (
                                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full">Regular</span>
                              )}
                            </div>
                          </TableCell>
                          {isEditMode && (
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-white border shadow-lg">
                                  <DropdownMenuItem onClick={() => handleEdit(familyMember)} className="cursor-pointer">
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDelete(familyMember.id)} className="text-red-600 cursor-pointer">
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
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Family Members Yet</h3>
            <p className="text-gray-600 mb-4">No family members have been added for this employee.</p>
            {isEditMode && (
              <Button
                onClick={() => setIsAddingNew(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Family Member
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
