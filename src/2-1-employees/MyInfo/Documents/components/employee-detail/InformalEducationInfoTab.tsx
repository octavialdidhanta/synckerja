
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent } from '@/shared/components/ui/card';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Plus, Edit, Trash2, Save, X, MoreVertical } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useInformalEducations, InformalEducation } from '@/shared/hooks/employees/useInformalEducations';
import { Employee } from '@/shared/hooks/employees/useEmployees';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

interface InformalEducationInfoTabProps {
  employee: Employee;
  isEditMode: boolean;
  onUpdate: () => void;
}

export const InformalEducationInfoTab = ({ employee, isEditMode, onUpdate }: InformalEducationInfoTabProps) => {
  const { organizationId } = useCurrentOrg();
  const { informalEducations, isLoading, addInformalEducation, updateInformalEducation, deleteInformalEducation } = useInformalEducations(employee.id);
  
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<InformalEducation>>({
    course_name: '',
    provider: '',
    field_of_certification: '',
    certificate_number: '',
    start_date: '',
    end_date: '',
    description: '',
  });

  const handleInputChange = (field: keyof InformalEducation, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.course_name) {
      return;
    }

    const educationData = {
      employee_id: employee.id,
      organization_id: organizationId,
      course_name: formData.course_name || '',
      provider: formData.provider || '',
      field_of_certification: formData.field_of_certification || '',
      certificate_number: formData.certificate_number || '',
      start_date: formData.start_date || undefined,
      end_date: formData.end_date || undefined,
      description: formData.description || '',
    };

    if (editingId) {
      await updateInformalEducation.mutateAsync({ id: editingId, data: educationData });
      setEditingId(null);
    } else {
      await addInformalEducation.mutateAsync(educationData);
      setIsAddingNew(false);
    }

    setFormData({
      course_name: '',
      provider: '',
      field_of_certification: '',
      certificate_number: '',
      start_date: '',
      end_date: '',
      description: '',
    });
  };

  const handleEdit = (education: InformalEducation) => {
    setEditingId(education.id);
    setFormData({
      course_name: education.course_name,
      provider: education.provider || '',
      field_of_certification: education.field_of_certification || '',
      certificate_number: education.certificate_number || '',
      start_date: education.start_date || '',
      end_date: education.end_date || '',
      description: education.description || '',
    });
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setFormData({
      course_name: '',
      provider: '',
      field_of_certification: '',
      certificate_number: '',
      start_date: '',
      end_date: '',
      description: '',
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this informal education record?')) {
      await deleteInformalEducation.mutateAsync(id);
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
            Add Informal Education
          </Button>
        </div>
      )}

      {/* Add New Informal Education Form */}
      {isAddingNew && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="course-name">Course Name *</Label>
                <Input
                  id="course-name"
                  value={formData.course_name || ''}
                  onChange={(e) => handleInputChange('course_name', e.target.value)}
                  placeholder="Enter course name"
                />
              </div>
              <div>
                <Label htmlFor="provider">Provider</Label>
                <Input
                  id="provider"
                  value={formData.provider || ''}
                  onChange={(e) => handleInputChange('provider', e.target.value)}
                  placeholder="Enter provider/institution"
                />
              </div>
              <div>
                <Label htmlFor="field">Field of Certification</Label>
                <Input
                  id="field"
                  value={formData.field_of_certification || ''}
                  onChange={(e) => handleInputChange('field_of_certification', e.target.value)}
                  placeholder="Enter field of certification"
                />
              </div>
              <div>
                <Label htmlFor="certificate">Certificate Number</Label>
                <Input
                  id="certificate"
                  value={formData.certificate_number || ''}
                  onChange={(e) => handleInputChange('certificate_number', e.target.value)}
                  placeholder="Enter certificate number"
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
                />
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter description or notes"
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

      {/* Informal Education Records Table */}
      {informalEducations && informalEducations.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Course & Provider</TableHead>
                    <TableHead className="w-[150px]">Field & Certificate</TableHead>
                    <TableHead className="w-[150px]">Period</TableHead>
                    <TableHead className="w-[250px]">Description</TableHead>
                    {isEditMode && <TableHead className="w-[50px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {informalEducations.map((education) => (
                    <TableRow key={education.id}>
                      {editingId === education.id ? (
                        <>
                          <TableCell className="p-2">
                            <div className="space-y-2">
                              <Input
                                value={formData.course_name || ''}
                                onChange={(e) => handleInputChange('course_name', e.target.value)}
                                placeholder="Course name"
                                className="text-sm"
                              />
                              <Input
                                value={formData.provider || ''}
                                onChange={(e) => handleInputChange('provider', e.target.value)}
                                placeholder="Provider"
                                className="text-sm"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="space-y-2">
                              <Input
                                value={formData.field_of_certification || ''}
                                onChange={(e) => handleInputChange('field_of_certification', e.target.value)}
                                placeholder="Field"
                                className="text-sm"
                              />
                              <Input
                                value={formData.certificate_number || ''}
                                onChange={(e) => handleInputChange('certificate_number', e.target.value)}
                                placeholder="Certificate #"
                                className="text-sm"
                              />
                            </div>
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
                                className="text-sm"
                              />
                            </div>
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
                              <div className="font-semibold text-sm">{education.course_name}</div>
                              <div className="text-sm text-gray-600">{education.provider || '-'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="text-sm">{education.field_of_certification || '-'}</div>
                              <div className="text-xs text-gray-500">{education.certificate_number || '-'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {education.start_date ? new Date(education.start_date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) : '-'} - {' '}
                              {education.end_date 
                                ? new Date(education.end_date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) 
                                : '-'
                              }
                            </div>
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
          <p>No informal education records found.</p>
          {isEditMode && (
            <p className="text-sm mt-2">Click "Add Informal Education" to get started.</p>
          )}
        </div>
      )}
    </div>
  );
};
