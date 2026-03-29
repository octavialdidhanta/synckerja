import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Briefcase, Plus, Edit, Trash2, Save, X, MoreVertical } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';

interface WorkExperience {
  id?: string;
  candidate_profile_id?: string;
  company_name: string;
  position: string;
  job_description?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  location?: string;
  created_at?: string;
  updated_at?: string;
}

interface WorkExperienceTabProps {
  candidate?: any;
  onUpdate?: (data: any) => void;
  isReadOnly?: boolean;
  candidateProfileId?: string;
  onWorkExperienceChange?: () => void;
}

export const WorkExperienceTab = ({ 
  candidate, 
  onUpdate, 
  isReadOnly = false, 
  candidateProfileId,
  onWorkExperienceChange
}: WorkExperienceTabProps) => {
  const [workExperiences, setWorkExperiences] = useState<WorkExperience[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<WorkExperience>>({
    company_name: '',
    position: '',
    job_description: '',
    start_date: '',
    end_date: '',
    is_current: false,
    location: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    if (candidateProfileId) {
      fetchWorkExperiences();
    }
  }, [candidateProfileId]);

  const fetchWorkExperiences = async () => {
    if (!candidateProfileId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidate_work_experiences')
        .select('*')
        .eq('candidate_profile_id', candidateProfileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setWorkExperiences(data as WorkExperience[] || []);
      
      // Notify parent component about work experience change
      if (onWorkExperienceChange) {
        onWorkExperienceChange();
      }
    } catch (error: any) {
      console.error('Error fetching work experiences:', error);
      toast({
        title: 'Error',
        description: 'Failed to load work experiences.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof WorkExperience, value: string | boolean | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.company_name || !formData.position) {
      toast({
        title: 'Validation Error',
        description: 'Company name and position are required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const experienceData = {
        candidate_profile_id: candidateProfileId,
        company_name: formData.company_name || '',
        position: formData.position || '',
        job_description: formData.job_description || null,
        start_date: formData.start_date || null,
        end_date: formData.is_current ? null : (formData.end_date || null),
        is_current: formData.is_current || false,
        location: formData.location || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('candidate_work_experiences')
          .update(experienceData)
          .eq('id', editingId);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Work experience updated successfully.',
        });
      } else {
        const { error } = await supabase
          .from('candidate_work_experiences')
          .insert(experienceData);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Work experience added successfully.',
        });
      }

      await fetchWorkExperiences();
      handleCancel();
    } catch (error: any) {
      console.error('Error saving work experience:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save work experience.',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setFormData({
      company_name: '',
      position: '',
      job_description: '',
      start_date: '',
      end_date: '',
      is_current: false,
      location: ''
    });
  };

  const handleEdit = (experience: WorkExperience) => {
    setEditingId(experience.id || null);
    setFormData({
      company_name: experience.company_name || '',
      position: experience.position || '',
      job_description: experience.job_description || '',
      start_date: experience.start_date || '',
      end_date: experience.end_date || '',
      is_current: experience.is_current || false,
      location: experience.location || ''
    });
    setIsAddingNew(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this work experience record?')) {
      try {
        const { error } = await supabase
          .from('candidate_work_experiences')
          .delete()
          .eq('id', id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Work experience deleted successfully.',
        });

        await fetchWorkExperiences();
      } catch (error: any) {
        console.error('Error deleting work experience:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to delete work experience.',
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
              <CardTitle className="text-lg font-semibold text-gray-900">Work Experience</CardTitle>
              {!isAddingNew && !editingId && !isReadOnly && (
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
          </CardHeader>
          <CardContent>
          {/* Add New Work Experience Form */}
          {isAddingNew && (
            <Card className="border-2 border-blue-200 bg-blue-50 mb-6">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="company_name">Company Name *</Label>
                    <Input
                      id="company_name"
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
                      placeholder="Enter position"
                    />
                  </div>
                  <div>
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date || ''}
                      onChange={(e) => handleInputChange('start_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date || ''}
                      onChange={(e) => handleInputChange('end_date', e.target.value)}
                      disabled={formData.is_current}
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
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_current"
                      checked={formData.is_current || false}
                      onCheckedChange={(checked) => handleInputChange('is_current', checked as boolean)}
                    />
                    <Label htmlFor="is_current" className="text-sm">Current Job</Label>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <Label htmlFor="job_description">Job Description</Label>
                  <Textarea
                    id="job_description"
                    value={formData.job_description || ''}
                    onChange={(e) => handleInputChange('job_description', e.target.value)}
                    placeholder="Enter job description"
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
                    Save Experience
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Work Experience Records Table */}
          {workExperiences && workExperiences.length > 0 ? (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Company & Position</TableHead>
                    <TableHead className="w-[120px]">Start Date</TableHead>
                    <TableHead className="w-[120px]">End Date</TableHead>
                    <TableHead className="w-[150px]">Location</TableHead>
                    <TableHead className="w-[200px]">Description</TableHead>
                    <TableHead className="w-[80px]">Current</TableHead>
                    {!isReadOnly && <TableHead className="w-[50px]">Actions</TableHead>}
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
                                placeholder="Company Name"
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
                              type="date"
                              value={formData.start_date || ''}
                              onChange={(e) => handleInputChange('start_date', e.target.value)}
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="date"
                              value={formData.end_date || ''}
                              onChange={(e) => handleInputChange('end_date', e.target.value)}
                              disabled={formData.is_current}
                              className="text-sm"
                            />
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
                            <Textarea
                              value={formData.job_description || ''}
                              onChange={(e) => handleInputChange('job_description', e.target.value)}
                              placeholder="Description"
                              className="text-sm"
                              rows={2}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Checkbox
                              checked={formData.is_current || false}
                              onCheckedChange={(checked) => handleInputChange('is_current', checked as boolean)}
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
                            <div className="text-sm">
                              {experience.start_date ? new Date(experience.start_date).toLocaleDateString() : '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {experience.is_current ? 'Present' : (experience.end_date ? new Date(experience.end_date).toLocaleDateString() : '-')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{experience.location || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm" title={experience.job_description || ''}>
                              {experience.job_description ? 
                                (experience.job_description.length > 50 ? 
                                  experience.job_description.substring(0, 50) + '...' : 
                                  experience.job_description
                                ) : '-'
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              {experience.is_current ? '✓' : '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {!isReadOnly && (
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
                                  <DropdownMenuItem onClick={() => handleDelete(experience.id!)} className="text-red-600 cursor-pointer">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p>No work experience records found.</p>
              <p className="text-sm mt-2">Click "Add Work Experience" to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
};
