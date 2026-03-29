import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Award, Plus, Edit, Trash2, Save, X, MoreVertical } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';

interface InformalEducation {
  id?: string;
  candidate_profile_id?: string;
  course_name: string;
  provider?: string;
  field_of_certification?: string;
  certificate_number?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

interface InformalEducationTabProps {
  candidate?: any;
  onUpdate?: (data: any) => void;
  isReadOnly?: boolean;
  candidateProfileId?: string;
}

export const InformalEducationTab = ({ 
  candidate, 
  onUpdate, 
  isReadOnly = false, 
  candidateProfileId
}: InformalEducationTabProps) => {
  const [informalEducations, setInformalEducations] = useState<InformalEducation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<InformalEducation>>({
    course_name: '',
    provider: '',
    field_of_certification: '',
    certificate_number: '',
    start_date: '',
    end_date: '',
    description: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    if (candidateProfileId) {
      fetchInformalEducations();
    }
  }, [candidateProfileId]);

  const fetchInformalEducations = async () => {
    if (!candidateProfileId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidate_informal_educations')
        .select('*')
        .eq('candidate_profile_id', candidateProfileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setInformalEducations(data as InformalEducation[] || []);
    } catch (error: any) {
      console.error('Error fetching informal educations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load informal educations.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof InformalEducation, value: string | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.course_name || formData.course_name.trim() === '') {
      toast({
        title: 'Validation Error',
        description: 'Course name is required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const educationData = {
        candidate_profile_id: candidateProfileId,
        course_name: formData.course_name || '',
        provider: formData.provider || null,
        field_of_certification: formData.field_of_certification || null,
        certificate_number: formData.certificate_number || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        description: formData.description || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('candidate_informal_educations')
          .update(educationData)
          .eq('id', editingId);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Informal education updated successfully.',
        });
      } else {
        const { error } = await supabase
          .from('candidate_informal_educations')
          .insert(educationData);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Informal education added successfully.',
        });
      }

      await fetchInformalEducations();
      handleCancel();
    } catch (error: any) {
      console.error('Error saving informal education:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save informal education.',
        variant: 'destructive',
      });
    }
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
      description: ''
    });
  };

  const handleEdit = (education: InformalEducation) => {
    setEditingId(education.id || null);
    setFormData({
      course_name: education.course_name || '',
      provider: education.provider || '',
      field_of_certification: education.field_of_certification || '',
      certificate_number: education.certificate_number || '',
      start_date: education.start_date || '',
      end_date: education.end_date || '',
      description: education.description || ''
    });
    setIsAddingNew(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this informal education record?')) {
      try {
        const { error } = await supabase
          .from('candidate_informal_educations')
          .delete()
          .eq('id', id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Informal education deleted successfully.',
        });

        await fetchInformalEducations();
      } catch (error: any) {
        console.error('Error deleting informal education:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to delete informal education.',
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
              <CardTitle className="text-lg font-semibold text-gray-900">Informal Education</CardTitle>
              {!isAddingNew && !editingId && !isReadOnly && (
                <Button
                  onClick={() => setIsAddingNew(true)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Informal Education
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
          {/* Add New Informal Education Form */}
          {isAddingNew && (
            <Card className="border-2 border-blue-200 bg-blue-50 mb-6">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="course_name">Course Name *</Label>
                    <Input
                      id="course_name"
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
                      placeholder="Enter provider"
                    />
                  </div>
                  <div>
                    <Label htmlFor="field_of_certification">Field of Certification</Label>
                    <Input
                      id="field_of_certification"
                      value={formData.field_of_certification || ''}
                      onChange={(e) => handleInputChange('field_of_certification', e.target.value)}
                      placeholder="Enter field of certification"
                    />
                  </div>
                  <div>
                    <Label htmlFor="certificate_number">Certificate Number</Label>
                    <Input
                      id="certificate_number"
                      value={formData.certificate_number || ''}
                      onChange={(e) => handleInputChange('certificate_number', e.target.value)}
                      placeholder="Enter certificate number"
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
                    />
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Enter description"
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
                    Save Education
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Informal Education Records Table */}
          {informalEducations && informalEducations.length > 0 ? (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Course Name</TableHead>
                    <TableHead className="w-[150px]">Provider</TableHead>
                    <TableHead className="w-[150px]">Field of Certification</TableHead>
                    <TableHead className="w-[120px]">Certificate Number</TableHead>
                    <TableHead className="w-[120px]">Start Date</TableHead>
                    <TableHead className="w-[120px]">End Date</TableHead>
                    <TableHead className="w-[200px]">Description</TableHead>
                    {!isReadOnly && <TableHead className="w-[50px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {informalEducations.map((education) => (
                    <TableRow key={education.id}>
                      {editingId === education.id ? (
                        <>
                          <TableCell className="p-2">
                            <Input
                              value={formData.course_name || ''}
                              onChange={(e) => handleInputChange('course_name', e.target.value)}
                              placeholder="Course Name"
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={formData.provider || ''}
                              onChange={(e) => handleInputChange('provider', e.target.value)}
                              placeholder="Provider"
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={formData.field_of_certification || ''}
                              onChange={(e) => handleInputChange('field_of_certification', e.target.value)}
                              placeholder="Field"
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={formData.certificate_number || ''}
                              onChange={(e) => handleInputChange('certificate_number', e.target.value)}
                              placeholder="Certificate #"
                              className="text-sm"
                            />
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
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Textarea
                              value={formData.description || ''}
                              onChange={(e) => handleInputChange('description', e.target.value)}
                              placeholder="Description"
                              className="text-sm"
                              rows={2}
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
                            <div className="font-semibold text-sm">{education.course_name}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{education.provider || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{education.field_of_certification || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{education.certificate_number || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {education.start_date ? new Date(education.start_date).toLocaleDateString() : '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {education.end_date ? new Date(education.end_date).toLocaleDateString() : '-'}
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
                          <TableCell>
                            {!isReadOnly && (
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
                                  <DropdownMenuItem onClick={() => handleDelete(education.id!)} className="text-red-600 cursor-pointer">
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
              <p>No informal education records found.</p>
              <p className="text-sm mt-2">Click "Add Informal Education" to get started. (Optional)</p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
};
