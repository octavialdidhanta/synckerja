import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Plus, Edit, Trash2, Save, X, MoreVertical, FileText, Download, Eye } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useEmployeeDocuments, EmployeeDocument } from '@/shared/hooks/employees/useEmployeeDocuments';
import { Employee } from '@/shared/hooks/employees/useEmployees';

interface DocumentsTabProps {
  employee: Employee;
  isEditMode: boolean;
  onUpdate: () => void;
}

export const DocumentsTab = ({ employee, isEditMode, onUpdate }: DocumentsTabProps) => {
  const { documents, isLoading, addDocument, updateDocument, deleteDocument } = useEmployeeDocuments(employee.id);
  
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<EmployeeDocument>>({
    file_name: '',
    document_type: '',
    file_path: '',
    file_size: undefined,
    mime_type: '',
    notes: '',
    is_verified: false,
  });

  const documentTypes = [
    { value: 'cv', label: 'CV/Resume' },
    { value: 'id_card', label: 'ID Card (KTP)' },
    { value: 'family_card', label: 'Family Card (KK)' },
    { value: 'diploma', label: 'Diploma' },
    { value: 'certificate', label: 'Certificate' },
    { value: 'other', label: 'Other' },
  ];

  const handleInputChange = (field: keyof EmployeeDocument, value: string | boolean | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.file_name || !formData.document_type) {
      return;
    }

    const documentData = {
      employee_id: employee.id,
      file_name: formData.file_name || '',
      document_type: formData.document_type || '',
      file_path: formData.file_path || '',
      file_size: formData.file_size || 0,
      mime_type: formData.mime_type || '',
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
      file_size: undefined,
      mime_type: '',
      notes: '',
      is_verified: false,
    });
  };

  const handleEdit = (document: EmployeeDocument) => {
    setEditingId(document.id);
    setFormData({
      file_name: document.file_name,
      document_type: document.document_type,
      file_path: document.file_path || '',
      file_size: document.file_size || 0,
      mime_type: document.mime_type || '',
      notes: document.notes || '',
      is_verified: document.is_verified || false,
    });
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setFormData({
      file_name: '',
      document_type: '',
      file_path: '',
      file_size: undefined,
      mime_type: '',
      notes: '',
      is_verified: false,
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      await deleteDocument.mutateAsync(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Employee Documents</h3>
        {isEditMode && !isAddingNew && !editingId && (
          <Button
            onClick={() => setIsAddingNew(true)}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        )}
      </div>

      {/* Add New Document Form */}
      {isAddingNew && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="fileName">File Name *</Label>
                <Input
                  id="fileName"
                  value={formData.file_name || ''}
                  onChange={(e) => handleInputChange('file_name', e.target.value)}
                  placeholder="Enter file name"
                />
              </div>
              <div>
                <Label htmlFor="documentType">Document Type *</Label>
                <Select
                  value={formData.document_type || ''}
                  onValueChange={(value) => handleInputChange('document_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filePath">File Path</Label>
                <Input
                  id="filePath"
                  value={formData.file_path || ''}
                  onChange={(e) => handleInputChange('file_path', e.target.value)}
                  placeholder="Enter file path"
                />
              </div>
              <div>
                <Label htmlFor="fileSize">File Size (bytes)</Label>
                <Input
                  id="fileSize"
                  type="number"
                  value={formData.file_size || ''}
                  onChange={(e) => handleInputChange('file_size', parseInt(e.target.value) || 0)}
                  placeholder="Enter file size"
                />
              </div>
              <div>
                <Label htmlFor="mimeType">MIME Type</Label>
                <Input
                  id="mimeType"
                  value={formData.mime_type || ''}
                  onChange={(e) => handleInputChange('mime_type', e.target.value)}
                  placeholder="Enter MIME type"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isVerified"
                  checked={formData.is_verified || false}
                  onChange={(e) => handleInputChange('is_verified', e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="isVerified">Document is verified</Label>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Enter notes or additional information"
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

      {/* Documents Records Table */}
      {documents && documents.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Document Records</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Document Name</TableHead>
                    <TableHead className="w-[150px]">Type</TableHead>
                    <TableHead className="w-[120px]">Upload Date</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[200px]">Notes</TableHead>
                    {isEditMode && <TableHead className="w-[50px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((document) => (
                    <TableRow key={document.id}>
                      {editingId === document.id ? (
                        <>
                          <TableCell className="p-2">
                            <Input
                              value={formData.file_name || ''}
                              onChange={(e) => handleInputChange('file_name', e.target.value)}
                              placeholder="File name"
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Select
                              value={formData.document_type || ''}
                              onValueChange={(value) => handleInputChange('document_type', value)}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {documentTypes.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2">
                            <span className="text-sm text-gray-500">
                              {document.created_at ? new Date(document.created_at).toLocaleDateString('id-ID') : '-'}
                            </span>
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={formData.is_verified || false}
                                onChange={(e) => handleInputChange('is_verified', e.target.checked)}
                                className="h-3 w-3"
                              />
                              <span className="text-xs">Verified</span>
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
                            <div className="text-sm font-medium">{document.file_name}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{documentTypes.find(t => t.value === document.document_type)?.label || document.document_type}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {document.created_at ? new Date(document.created_at).toLocaleDateString('id-ID') : '-'}
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
                            <div className="text-sm" title={document.notes || ''}>
                              {document.notes ? 
                                (document.notes.length > 50 ? 
                                  document.notes.substring(0, 50) + '...' : 
                                  document.notes
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
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Documents Yet</h3>
            <p className="text-gray-600 mb-4">No documents have been uploaded for this employee.</p>
            {isEditMode && (
              <Button
                onClick={() => setIsAddingNew(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

