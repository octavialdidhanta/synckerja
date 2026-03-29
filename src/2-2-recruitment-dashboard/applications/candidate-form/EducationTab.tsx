
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Plus, Edit, Trash2, Save, X, MoreVertical } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';

interface EducationTabProps {
  candidateProfileId: string;
  onEducationChange?: () => void;
  isReadOnly?: boolean;
}

export function EducationTab({ candidateProfileId, onEducationChange, isReadOnly = false }: EducationTabProps) {
  const [educations, setEducations] = useState<any[]>([]);
  const [informalEducations, setInformalEducations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [informalLoading, setInformalLoading] = useState(true);
  const { toast } = useToast();
  
  const [editingEducation, setEditingEducation] = useState<string | null>(null);
  const [editingInformal, setEditingInformal] = useState<string | null>(null);
  const [showAddEducation, setShowAddEducation] = useState(false);
  const [showAddInformal, setShowAddInformal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    institution_name: '',
    degree: '',
    field_of_study: '',
    start_date: '',
    end_date: '',
    grade_gpa: '',
    description: '',
    is_current: false
  });

  useEffect(() => {
    if (candidateProfileId) {
      fetchEducations();
      fetchInformalEducations();
    } else {
      setLoading(false);
      setInformalLoading(false);
    }
  }, [candidateProfileId]);

  const fetchEducations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('candidate_educations')
        .select('*')
        .eq('candidate_profile_id', candidateProfileId)
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      setEducations(data || []);
    } catch (error) {
      console.error('Error fetching educations:', error);
      toast({
        title: "Error",
        description: "Failed to load education records",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInformalEducations = async () => {
    try {
      setInformalLoading(true);
      const { data, error } = await supabase
        .from('candidate_informal_educations')
        .select('*')
        .eq('candidate_profile_id', candidateProfileId)
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      setInformalEducations(data || []);
    } catch (error) {
      console.error('Error fetching informal educations:', error);
      toast({
        title: "Error",
        description: "Failed to load certification records",
        variant: "destructive"
      });
    } finally {
      setInformalLoading(false);
    }
  };
  
  const [newEducation, setNewEducation] = useState({
    institution_name: '',
    degree: '',
    field_of_study: '',
    start_date: '',
    end_date: '',
    grade_gpa: '',
    description: '',
    is_current: false
  });

  const [newInformal, setNewInformal] = useState({
    course_name: '',
    provider: '',
    field_of_certification: '',
    certificate_number: '',
    start_date: '',
    end_date: '',
    description: ''
  });

  const handleAddEducation = async () => {
    try {
      const { data, error } = await supabase
        .from('candidate_educations')
        .insert({
          candidate_profile_id: candidateProfileId,
          ...newEducation
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setEducations([data, ...educations]);
      setNewEducation({
        institution_name: '',
        degree: '',
        field_of_study: '',
        start_date: '',
        end_date: '',
        grade_gpa: '',
        description: '',
        is_current: false
      });
      setShowAddEducation(false);
      onEducationChange?.();
      toast({
        title: "Success",
        description: "Education record added successfully"
      });
    } catch (error: any) {
      console.error('Error adding education:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add education record",
        variant: "destructive"
      });
    }
  };

  const handleEditEducation = (education: any) => {
    setEditingEducation(education.id);
    setEditFormData({
      institution_name: education.institution_name || '',
      degree: education.degree || '',
      field_of_study: education.field_of_study || '',
      start_date: education.start_date || '',
      end_date: education.end_date || '',
      grade_gpa: education.grade_gpa || '',
      description: education.description || '',
      is_current: education.is_current || false
    });
  };

  const handleUpdateEducation = async () => {
    if (!editFormData.institution_name || !editFormData.degree) {
      toast({
        title: "Validation Error",
        description: "Institution name and degree are required.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('candidate_educations')
        .update(editFormData)
        .eq('id', editingEducation);

      if (error) throw error;

      await fetchEducations();
      setEditingEducation(null);
      onEducationChange?.();
      toast({
        title: "Success",
        description: "Education record updated successfully"
      });
    } catch (error: any) {
      console.error('Error updating education:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update education record",
        variant: "destructive"
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingEducation(null);
    setEditFormData({
      institution_name: '',
      degree: '',
      field_of_study: '',
      start_date: '',
      end_date: '',
      grade_gpa: '',
      description: '',
      is_current: false
    });
  };

  const handleDeleteEducationClick = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this education record?')) {
      try {
        const { error } = await supabase
          .from('candidate_educations')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        await fetchEducations();
        onEducationChange?.();
        toast({
          title: "Success",
          description: "Education record deleted successfully"
        });
      } catch (error: any) {
        console.error('Error deleting education:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to delete education record",
          variant: "destructive"
        });
      }
    }
  };

  const handleAddInformal = async () => {
    try {
      const { data, error } = await supabase
        .from('candidate_informal_educations')
        .insert({
          candidate_profile_id: candidateProfileId,
          ...newInformal
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setInformalEducations([data, ...informalEducations]);
      setNewInformal({
        course_name: '',
        provider: '',
        field_of_certification: '',
        certificate_number: '',
        start_date: '',
        end_date: '',
        description: ''
      });
      setShowAddInformal(false);
      toast({
        title: "Success",
        description: "Certification added successfully"
      });
    } catch (error: any) {
      console.error('Error adding informal education:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add certification",
        variant: "destructive"
      });
    }
  };

  const handleDeleteInformalEducation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('candidate_informal_educations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setInformalEducations(informalEducations.filter(edu => edu.id !== id));
      toast({
        title: "Success",
        description: "Certification deleted successfully"
      });
    } catch (error: any) {
      console.error('Error deleting informal education:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete certification",
        variant: "destructive"
      });
    }
  };

  if (loading || informalLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 max-h-[calc(100vh-120px)]">
      <div className="space-y-6 seamless-scroll overflow-y-auto flex-1">
        {/* Formal Education Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Formal Education</CardTitle>
            {!isReadOnly && (
              <Button
                size="sm"
                onClick={() => setShowAddEducation(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Education
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
          {showAddEducation && (
            <Card className="border-2 border-blue-200">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Institution Name *</Label>
                    <Input
                      value={newEducation.institution_name}
                      onChange={(e) => setNewEducation(prev => ({ ...prev, institution_name: e.target.value }))}
                      placeholder="University/School name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Degree *</Label>
                    <Input
                      value={newEducation.degree}
                      onChange={(e) => setNewEducation(prev => ({ ...prev, degree: e.target.value }))}
                      placeholder="Bachelor's, Master's, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Field of Study</Label>
                    <Input
                      value={newEducation.field_of_study}
                      onChange={(e) => setNewEducation(prev => ({ ...prev, field_of_study: e.target.value }))}
                      placeholder="Computer Science, Engineering, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Grade/GPA</Label>
                    <Input
                      value={newEducation.grade_gpa}
                      onChange={(e) => setNewEducation(prev => ({ ...prev, grade_gpa: e.target.value }))}
                      placeholder="3.8/4.0, Cum Laude, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={newEducation.start_date}
                      onChange={(e) => setNewEducation(prev => ({ ...prev, start_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={newEducation.end_date}
                      onChange={(e) => setNewEducation(prev => ({ ...prev, end_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newEducation.description}
                    onChange={(e) => setNewEducation(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Additional details about your education..."
                    rows={3}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowAddEducation(false)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddEducation}
                    disabled={!newEducation.institution_name || !newEducation.degree}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {educations.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p>No education records found.</p>
              <p className="text-sm mt-2">Click "Add Education" to get started.</p>
            </div>
          ) : (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Degree & Institution</TableHead>
                    <TableHead className="w-[150px]">Field of Study</TableHead>
                    <TableHead className="w-[120px]">Start Date</TableHead>
                    <TableHead className="w-[120px]">End Date</TableHead>
                    <TableHead className="w-[100px]">GPA</TableHead>
                    <TableHead className="w-[200px]">Description</TableHead>
                    {!isReadOnly && <TableHead className="w-[50px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {educations.map((education) => (
                    <TableRow key={education.id}>
                      {editingEducation === education.id ? (
                        <>
                          <TableCell className="p-2">
                            <div className="space-y-2">
                              <Input
                                value={editFormData.degree}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, degree: e.target.value }))}
                                placeholder="Degree"
                                className="text-sm"
                              />
                              <Input
                                value={editFormData.institution_name}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, institution_name: e.target.value }))}
                                placeholder="Institution Name"
                                className="text-sm"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={editFormData.field_of_study}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, field_of_study: e.target.value }))}
                              placeholder="Field of Study"
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="date"
                              value={editFormData.start_date}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, start_date: e.target.value }))}
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="date"
                              value={editFormData.end_date}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, end_date: e.target.value }))}
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={editFormData.grade_gpa}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, grade_gpa: e.target.value }))}
                              placeholder="GPA"
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Textarea
                              value={editFormData.description}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Description"
                              className="text-sm"
                              rows={2}
                            />
                          </TableCell>
                          {!isReadOnly && (
                          <TableCell className="p-2">
                            <div className="flex space-x-1">
                              <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-6 w-6 p-0">
                                <X className="h-3 w-3" />
                              </Button>
                              <Button size="sm" onClick={handleUpdateEducation} className="h-6 w-6 p-0 bg-green-600 hover:bg-green-700">
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
                              <div className="font-semibold text-sm">{education.degree || '-'}</div>
                              <div className="text-sm text-blue-600">{education.institution_name || '-'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{education.field_of_study || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {education.start_date ? new Date(education.start_date).getFullYear() : '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {education.end_date ? new Date(education.end_date).getFullYear() : 'Present'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{education.grade_gpa || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm" title={education.description || ''}>
                              {education.description ? 
                                (education.description.length > 30 ? 
                                  education.description.substring(0, 30) + '...' : 
                                  education.description
                                ) : '-'
                              }
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
                                  <DropdownMenuItem onClick={() => handleEditEducation(education)} className="cursor-pointer">
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDeleteEducationClick(education.id)} className="text-red-600 cursor-pointer">
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
          )}
        </CardContent>
      </Card>

      {/* Informal Education Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Certifications & Courses</CardTitle>
          {!isReadOnly && (
            <Button
              size="sm"
              onClick={() => setShowAddInformal(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Certification
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddInformal && (
            <Card className="border-2 border-green-200">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Course/Certification Name *</Label>
                    <Input
                      value={newInformal.course_name}
                      onChange={(e) => setNewInformal(prev => ({ ...prev, course_name: e.target.value }))}
                      placeholder="AWS Certified Solutions Architect"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Input
                      value={newInformal.provider}
                      onChange={(e) => setNewInformal(prev => ({ ...prev, provider: e.target.value }))}
                      placeholder="Amazon, Coursera, Udemy, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Field of Certification</Label>
                    <Input
                      value={newInformal.field_of_certification}
                      onChange={(e) => setNewInformal(prev => ({ ...prev, field_of_certification: e.target.value }))}
                      placeholder="Cloud Computing, Data Science, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Certificate Number</Label>
                    <Input
                      value={newInformal.certificate_number}
                      onChange={(e) => setNewInformal(prev => ({ ...prev, certificate_number: e.target.value }))}
                      placeholder="Certificate ID or number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={newInformal.start_date}
                      onChange={(e) => setNewInformal(prev => ({ ...prev, start_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={newInformal.end_date}
                      onChange={(e) => setNewInformal(prev => ({ ...prev, end_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newInformal.description}
                    onChange={(e) => setNewInformal(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Skills learned, projects completed, etc."
                    rows={3}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowAddInformal(false)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddInformal}
                    disabled={!newInformal.course_name}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {informalEducations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No certifications found. Click "Add Certification" to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {informalEducations.map((informal) => (
                <Card key={informal.id} className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{informal.course_name}</h4>
                        {informal.provider && (
                          <p className="text-green-600 font-medium">{informal.provider}</p>
                        )}
                        {informal.field_of_certification && (
                          <p className="text-gray-600">{informal.field_of_certification}</p>
                        )}
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-2">
                          {informal.start_date && (
                            <span>
                              {new Date(informal.start_date).getFullYear()} - {' '}
                              {informal.end_date ? new Date(informal.end_date).getFullYear() : 'Present'}
                            </span>
                          )}
                          {informal.certificate_number && (
                            <span>Cert: {informal.certificate_number}</span>
                          )}
                        </div>
                        {informal.description && (
                          <p className="text-gray-700 mt-2">{informal.description}</p>
                        )}
                      </div>
                      {!isReadOnly && (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingInformal(informal.id)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteInformalEducation(informal.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
