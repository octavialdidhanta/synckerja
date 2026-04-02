
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Plus, Edit, Trash2, Save, X, MoreVertical } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useWorkExperiences, WorkExperience } from '@/shared/hooks/employees/useWorkExperiences';
import { Employee } from '@/shared/hooks/employees/useEmployees';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

interface WorkExperienceTabProps {
  employee: Employee;
  isEditMode: boolean;
  onUpdate: () => void;
}

export const WorkExperienceTab = ({ employee, isEditMode, onUpdate }: WorkExperienceTabProps) => {
  const { organizationId } = useCurrentOrg();
  const { workExperiences, isLoading, addWorkExperience, updateWorkExperience, deleteWorkExperience } = useWorkExperiences(employee.id);
  
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<WorkExperience>>({
    company_name: '',
    position: '',
    location: '',
    start_date: '',
    end_date: '',
    is_current: false,
    job_description: '',
  });

  const handleInputChange = (field: keyof WorkExperience, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.company_name || !formData.position) {
      return;
    }

    const experienceData = {
      employee_id: employee.id,
      organization_id: organizationId,
      company_name: formData.company_name || '',
      position: formData.position || '',
      location: formData.location || '',
      start_date: formData.start_date || undefined,
      end_date: formData.is_current ? undefined : formData.end_date || undefined,
      is_current: formData.is_current || false,
      job_description: formData.job_description || '',
    };

    if (editingId) {
      await updateWorkExperience.mutateAsync({ id: editingId, data: experienceData });
      setEditingId(null);
    } else {
      await addWorkExperience.mutateAsync(experienceData);
      setIsAddingNew(false);
    }

    setFormData({
      company_name: '',
      position: '',
      location: '',
      start_date: '',
      end_date: '',
      is_current: false,
      job_description: '',
    });
  };

  const handleEdit = (experience: WorkExperience) => {
    setEditingId(experience.id);
    setFormData({
      company_name: experience.company_name,
      position: experience.position,
      location: experience.location || '',
      start_date: experience.start_date || '',
      end_date: experience.end_date || '',
      is_current: experience.is_current || false,
      job_description: experience.job_description || '',
    });
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setFormData({
      company_name: '',
      position: '',
      location: '',
      start_date: '',
      end_date: '',
      is_current: false,
      job_description: '',
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this work experience record?')) {
      await deleteWorkExperience.mutateAsync(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Work Experience</h3>
        {isEditMode && !isAddingNew && !editingId && (
          <Button
            onClick={() => setIsAddingNew(true)}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Work Experience
          </Button>
        )}
      </div>

      {/* Add New Work Experience Form */}
      {isAddingNew && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="company-name">Company Name *</Label>
                <Input
                  id="company-name"
                  value={formData.company_name || ''}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                  placeholder="Enter company name"
                />
              </div>
              <div>
                <Label htmlFor="position">Position *</Label>
                <Input
                  id="position"
                  value={formData.position || ''}
                  onChange={(e) => handleInputChange('position', e.target.value)}
                  placeholder="Enter position/job title"
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location || ''}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Enter location"
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
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-current"
                  checked={formData.is_current || false}
                  onCheckedChange={(checked) => handleInputChange('is_current', checked as boolean)}
                />
                <Label htmlFor="is-current" className="text-sm">Currently working here</Label>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <Label htmlFor="job-description">Job Description</Label>
              <Textarea
                id="job-description"
                value={formData.job_description || ''}
                onChange={(e) => handleInputChange('job_description', e.target.value)}
                placeholder="Describe your responsibilities and achievements"
                rows={4}
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

      {/* Work Experience Records Table */}
      {workExperiences && workExperiences.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Work Experience Records</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Company & Position</TableHead>
                    <TableHead className="w-[150px]">Location</TableHead>
                    <TableHead className="w-[150px]">Period</TableHead>
                    <TableHead className="w-[250px]">Description</TableHead>
                    {isEditMode && <TableHead className="w-[50px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workExperiences.map((experience) => (
                    <TableRow key={experience.id}>
                      {editingId === experience.id ? (
                        <>
                          <TableCell className="p-2">
                            <div className="space-y-2">
                              <Input
                                value={formData.company_name || ''}
                                onChange={(e) => handleInputChange('company_name', e.target.value)}
                                placeholder="Company name"
                                className="text-sm"
                              />
                              <Input
                                value={formData.position || ''}
                                onChange={(e) => handleInputChange('position', e.target.value)}
                                placeholder="Position"
                                className="text-sm"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={formData.location || ''}
                              onChange={(e) => handleInputChange('location', e.target.value)}
                              placeholder="Location"
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
                                className="text-sm"
                                disabled={formData.is_current}
                              />
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  checked={formData.is_current || false}
                                  onCheckedChange={(checked) => handleInputChange('is_current', checked as boolean)}
                                />
                                <Label className="text-xs">Current</Label>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <Textarea
                              value={formData.job_description || ''}
                              onChange={(e) => handleInputChange('job_description', e.target.value)}
                              placeholder="Job description"
                              rows={3}
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
                              <div className="font-semibold text-sm">{experience.company_name}</div>
                              <div className="text-sm text-gray-600">{experience.position}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{experience.location || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {experience.start_date ? new Date(experience.start_date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) : '-'} - {' '}
                              {experience.is_current ? 'Present' : 
                                (experience.end_date 
                                  ? new Date(experience.end_date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) 
                                  : '-'
                                )
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm" title={experience.job_description || ''}>
                              {experience.job_description ? 
                                (experience.job_description.length > 100 ? 
                                  experience.job_description.substring(0, 100) + '...' : 
                                  experience.job_description
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
                                  <DropdownMenuItem onClick={() => handleEdit(experience)} className="cursor-pointer">
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDelete(experience.id)} className="text-red-600 cursor-pointer">
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
          <p>No work experience records found.</p>
          {isEditMode && (
            <p className="text-sm mt-2">Click "Add Work Experience" to get started.</p>
          )}
        </div>
      )}
    </div>
  );
};
