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
import { Plus, Edit, Trash2, Save, X, MoreVertical, FileText, Download, Eye } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useEmployeeDocuments, EmployeeDocument } from '@/hooks/useEmployeeDocuments';
import { Employee } from '@/hooks/useEmployees';
import { FileUpload } from '@/shared/components/ui/file-upload';

interface DocumentsInfoTabProps {
  employee: Employee;
  isEditMode: boolean;
  onUpdate: () => void;
}

export const DocumentsInfoTab = ({ employee, isEditMode, onUpdate }: DocumentsInfoTabProps) => {
  const { documents, isLoading, addDocument, updateDocument, deleteDocument } = useEmployeeDocuments(employee.id);
  
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<any>>({
    file_name: '',
    document_type: '',
    file_path: '',
    notes: '',
    is_verified: false,
  });

  const handleInputChange = (field: keyof EmployeeDocument, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = (filePath: string | undefined) => {
    if (filePath) {
      // Extract filename from path
      const fileName = filePath.split('/').pop() || 'document';
      setFormData(prev => ({
        ...prev,
        file_path: filePath,
        file_name: fileName
      }));
    }
  };

  const handleSave = async () => {
    if (!formData.file_name || !formData.document_type || !formData.file_path) {
      return;
    }

    const documentData = {
      employee_id: employee.id,
      file_name: formData.file_name || '',
      document_type: formData.document_type || '',
      file_path: formData.file_path || '',
      notes: formData.notes || '',
      is_verified: formData.is_verified || false,
    };

    if (editingId) {
      await updateDocument.mutateAsync({ id: editingId, data: documentData });
      setEditingId(null);
    } else {
      await addDocument.mutateAsync(documentData);
      setIsAddingNew(false);
    }

    setFormData({
      file_name: '',
      document_type: '',
      file_path: '',
      notes: '',
      is_verified: false,
    });
  };

  const handleEdit = (document: EmployeeDocument) => {
    setEditingId(document.id);
    setFormData({
      file_name: document.file_name,
      document_type: document.document_type,
      file_path: document.file_path,
      notes: document.notes || '',
      is_verified: document.is_verified,
    });
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setFormData({
      file_name: '',
      document_type: '',
      file_path: '',
      notes: '',
      is_verified: false,
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this document record?')) {
      await deleteDocument.mutateAsync(id);
    }
  };

  const getFileUrl = (filePath: string) => {
    return `https://najgdwffjhnqlogfrlqa.supabase.co/storage/v1/object/public/employee-documents/${filePath}`;
  };

  const handleDownload = (document: EmployeeDocument) => {
    const url = getFileUrl(document.file_path || '');
    window.open(url, '_blank');
  };

  const handleView = (document: EmployeeDocument) => {
    const url = getFileUrl(document.file_path || '');
    window.open(url, '_blank');
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
        <h3 className="text-lg font-semibold text-gray-900">Documents Information</h3>
        {isEditMode && !isAddingNew && !editingId && (
          <Button
            onClick={() => setIsAddingNew(true)}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        )}
      </div>

      {/* Add New Document Form */}
      {isAddingNew && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="document-type">Document Type *</Label>
                <Select value={formData.document_type || ''} onValueChange={(value) => handleInputChange('document_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="id_card">ID Card</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="certificate">Certificate</SelectItem>
                    <SelectItem value="diploma">Diploma</SelectItem>
                    <SelectItem value="cv">CV/Resume</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="medical">Medical Record</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="file-name">File Name *</Label>
                <Input
                  id="file-name"
                  value={formData.file_name || ''}
                  onChange={(e) => handleInputChange('file_name', e.target.value)}
                  placeholder="Enter file name"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <Label>Upload Document *</Label>
              <FileUpload
                id="document-upload"
                label="Upload Document"
                value={formData.file_path}
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                maxSize={5 * 1024 * 1024} // 5MB
              />
            </div>

            <div className="space-y-2 mb-4">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Enter notes about this document"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2 mb-4">
              <Checkbox
                id="verified"
                checked={formData.is_verified || false}
                onCheckedChange={(checked) => handleInputChange('is_verified', checked as boolean)}
              />
              <Label htmlFor="verified">Document is verified</Label>
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

      {/* Documents Records Table */}
      {documents && documents.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Documents Records</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Document Info</TableHead>
                    <TableHead className="w-[150px]">Type</TableHead>
                    <TableHead className="w-[200px]">Upload Date</TableHead>
                    <TableHead className="w-[250px]">Notes</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                    {isEditMode && <TableHead className="w-[50px]">Edit</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((document) => (
                    <TableRow key={document.id}>
                      {editingId === document.id ? (
                        <>
                          <TableCell className="p-2">
                            <div className="space-y-2">
                              <Input
                                value={formData.file_name || ''}
                                onChange={(e) => handleInputChange('file_name', e.target.value)}
                                placeholder="File name"
                                className="text-sm"
                              />
                              <FileUpload
                                id={`edit-upload-${document.id}`}
                                label="Change File"
                                value={formData.file_path}
                                onChange={handleFileUpload}
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                maxSize={5 * 1024 * 1024}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <Select value={formData.document_type || ''} onValueChange={(value) => handleInputChange('document_type', value)}>
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="id_card">ID Card</SelectItem>
                                <SelectItem value="passport">Passport</SelectItem>
                                <SelectItem value="certificate">Certificate</SelectItem>
                                <SelectItem value="diploma">Diploma</SelectItem>
                                <SelectItem value="cv">CV/Resume</SelectItem>
                                <SelectItem value="contract">Contract</SelectItem>
                                <SelectItem value="medical">Medical Record</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="text-sm text-gray-600">
                              {document.created_at ? new Date(document.created_at).toLocaleDateString('id-ID') : '-'}
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <Textarea
                              value={formData.notes || ''}
                              onChange={(e) => handleInputChange('notes', e.target.value)}
                              placeholder="Notes"
                              rows={2}
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={formData.is_verified || false}
                                onCheckedChange={(checked) => handleInputChange('is_verified', checked as boolean)}
                              />
                              <span className="text-xs">Verified</span>
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="flex space-x-1">
                              <Button size="sm" variant="outline" onClick={() => handleView(document)} className="h-6 w-6 p-0">
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDownload(document)} className="h-6 w-6 p-0">
                                <Download className="h-3 w-3" />
                              </Button>
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
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <div>
                                <div className="font-semibold text-sm">{document.file_name}</div>
                                <div className="text-xs text-gray-500">
                                  {document.file_size ? `${Math.round(document.file_size / 1024)} KB` : 'Unknown size'}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm capitalize">{document.document_type.replace('_', ' ')}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {document.created_at ? new Date(document.created_at).toLocaleDateString('id-ID') : '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm" title={document.notes || ''}>
                              {document.notes ? 
                                (document.notes.length > 50 ? 
                                  document.notes.substring(0, 50) + '...' : 
                                  document.notes
                                ) : '-'
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              {document.is_verified ? (
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">Verified</span>
                              ) : (
                                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Pending</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button size="sm" variant="outline" onClick={() => handleView(document)} className="h-6 w-6 p-0">
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDownload(document)} className="h-6 w-6 p-0">
                                <Download className="h-3 w-3" />
                              </Button>
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
                                  <DropdownMenuItem onClick={() => handleEdit(document)} className="cursor-pointer">
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDelete(document.id)} className="text-red-600 cursor-pointer">
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
            <p className="text-gray-500 mb-4">No document records found.</p>
            {isEditMode && (
              <Button
                onClick={() => setIsAddingNew(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Document
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

