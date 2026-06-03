
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Plus, Edit, Trash2, Save, X, MoreVertical } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useEducations, Education } from '@/shared/hooks/employees/useEducations';
import { Employee } from '@/shared/hooks/employees/useEmployees';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

interface EducationInfoTabProps {
  employee: Employee;
  isEditMode: boolean;
  onUpdate: () => void;
}

export const EducationInfoTab = ({ employee, isEditMode, onUpdate }: EducationInfoTabProps) => {
  const { organizationId } = useCurrentOrg();
  const { educations, isLoading, addEducation, updateEducation, deleteEducation } = useEducations(employee.id);
  
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Education>>({
    institution_name: '',
    degree: '',
    field_of_study: '',
    start_date: '',
    end_date: '',
    grade_gpa: '',
    description: '',
    is_current: false,
  });

  const handleInputChange = (field: keyof Education, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.institution_name || !formData.degree) {
      return;
    }

    const educationData = {
      employee_id: employee.id,
      organization_id: organizationId,
      institution_name: formData.institution_name || '',
      degree: formData.degree || '',
      field_of_study: formData.field_of_study || '',
      start_date: formData.start_date || undefined,
      end_date: formData.is_current ? undefined : formData.end_date || undefined,
      grade_gpa: formData.grade_gpa || '',
      description: formData.description || '',
      is_current: formData.is_current || false,
    };

    if (editingId) {
      await updateEducation.mutateAsync({ id: editingId, data: educationData });
      setEditingId(null);
    } else {
      await addEducation.mutateAsync(educationData);
      setIsAddingNew(false);
    }

    setFormData({
      institution_name: '',
      degree: '',
      field_of_study: '',
      start_date: '',
      end_date: '',
      grade_gpa: '',
      description: '',
      is_current: false,
    });
  };

  const handleEdit = (education: Education) => {
    setEditingId(education.id);
    setFormData({
      institution_name: education.institution_name,
      degree: education.degree,
      field_of_study: education.field_of_study || '',
      start_date: education.start_date || '',
      end_date: education.end_date || '',
      grade_gpa: education.grade_gpa || '',
      description: education.description || '',
      is_current: education.is_current,
    });
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setFormData({
      institution_name: '',
      degree: '',
      field_of_study: '',
      start_date: '',
      end_date: '',
      grade_gpa: '',
      description: '',
      is_current: false,
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this education record?')) {
      await deleteEducation.mutateAsync(id);
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
      {isEditMode && !isAddingNew && !editingId && (
        <div className="flex justify-end">
          <Button
            onClick={() => setIsAddingNew(true)}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Education
          </Button>
        </div>
      )}

      {/* Add New Education Form */}
      {isAddingNew && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="institution">Institution Name *</Label>
                <Input
                  id="institution"
                  value={formData.institution_name || ''}
                  onChange={(e) => handleInputChange('institution_name', e.target.value)}
                  placeholder="Enter institution name"
                />
              </div>
              <div>
                <Label htmlFor="degree">Degree *</Label>
                <Input
                  id="degree"
                  value={formData.degree || ''}
                  onChange={(e) => handleInputChange('degree', e.target.value)}
                  placeholder="Enter degree"
                />
              </div>
              <div>
                <Label htmlFor="field">Field of Study</Label>
                <Input
                  id="field"
                  value={formData.field_of_study || ''}
                  onChange={(e) => handleInputChange('field_of_study', e.target.value)}
                  placeholder="Enter field of study"
                />
              </div>
              <div>
                <Label htmlFor="gpa">Grade/GPA</Label>
                <Input
                  id="gpa"
                  value={formData.grade_gpa || ''}
                  onChange={(e) => handleInputChange('grade_gpa', e.target.value)}
                  placeholder="Enter grade or GPA"
                />
              </div>
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={formData.start_date || ''}
                  onChange={(e) => handleInputChange('start_date', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={formData.end_date || ''}
                  onChange={(e) => handleInputChange('end_date', e.target.value)}
                  disabled={formData.is_current}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox
                id="current"
                checked={formData.is_current || false}
                onCheckedChange={(checked) => handleInputChange('is_current', checked as boolean)}
              />
              <Label htmlFor="current">Currently studying here</Label>
            </div>
            <div className="space-y-2 mb-4">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter description or achievements"
                rows={3}
              />
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

      {/* Education Records Table */}
      {educations && educations.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Institution & Degree</TableHead>
                    <TableHead className="w-[150px]">Field of Study</TableHead>
                    <TableHead className="w-[200px]">Period</TableHead>
                    <TableHead className="w-[100px]">Grade/GPA</TableHead>
                    <TableHead className="w-[250px]">Description</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    {isEditMode && <TableHead className="w-[50px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {educations.map((education) => (
                    <TableRow key={education.id}>
                      {editingId === education.id ? (
                        <>
                          <TableCell className="p-2">
                            <div className="space-y-2">
                              <Input
                                value={formData.institution_name || ''}
                                onChange={(e) => handleInputChange('institution_name', e.target.value)}
                                placeholder="Institution"
                                className="text-sm"
                              />
                              <Input
                                value={formData.degree || ''}
                                onChange={(e) => handleInputChange('degree', e.target.value)}
                                placeholder="Degree"
                                className="text-sm"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={formData.field_of_study || ''}
                              onChange={(e) => handleInputChange('field_of_study', e.target.value)}
                              placeholder="Field of study"
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="space-y-2">
                              <Input
                                type="date"
                                value={formData.start_date || ''}
                                onChange={(e) => handleInputChange('start_date', e.target.value)}
                                className="text-sm"
                              />
                              <Input
                                type="date"
                                value={formData.end_date || ''}
                                onChange={(e) => handleInputChange('end_date', e.target.value)}
                                disabled={formData.is_current}
                                className="text-sm"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={formData.grade_gpa || ''}
                              onChange={(e) => handleInputChange('grade_gpa', e.target.value)}
                              placeholder="Grade/GPA"
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Textarea
                              value={formData.description || ''}
                              onChange={(e) => handleInputChange('description', e.target.value)}
                              placeholder="Description"
                              rows={2}
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={formData.is_current || false}
                                onCheckedChange={(checked) => handleInputChange('is_current', checked as boolean)}
                              />
                              <span className="text-xs">Current</span>
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
                              <div className="font-semibold text-sm">{education.institution_name}</div>
                              <div className="text-sm text-gray-600">{education.degree}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{education.field_of_study || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {education.start_date ? new Date(education.start_date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) : '-'} - {' '}
                              {education.is_current 
                                ? 'Present' 
                                : education.end_date 
                                  ? new Date(education.end_date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) 
                                  : '-'
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{education.grade_gpa || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm" title={education.description || ''}>
                              {education.description ? 
                                (education.description.length > 50 ? 
                                  education.description.substring(0, 50) + '...' : 
                                  education.description
                                ) : '-'
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              {education.is_current ? (
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">Current</span>
                              ) : (
                                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full">Completed</span>
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
                                  <DropdownMenuItem onClick={() => handleEdit(education)} className="cursor-pointer">
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDelete(education.id)} className="text-red-600 cursor-pointer">
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
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p>No education records found.</p>
          {isEditMode && (
            <p className="text-sm mt-2">Click "Add Education" to get started.</p>
          )}
        </div>
      )}
    </div>
  );
};
