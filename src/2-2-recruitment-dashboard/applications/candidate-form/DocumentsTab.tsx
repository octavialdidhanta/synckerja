import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { FileText, Upload, Eye, Trash2, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { supabase } from '@/shared/lib/supabaseClient';

interface Document {
  id?: string;
  file_name: string;
  file_path: string;
  document_type: string;
  mime_type?: string;
  file_size?: number;
  uploaded_at?: string;
}

interface DocumentsTabProps {
  candidate?: any;
  onUpdate?: (data: any) => void;
  isReadOnly?: boolean;
  candidateProfileId?: string;
  onDocumentsChange?: () => void;
}

export const DocumentsTab = ({ 
  candidate, 
  onUpdate, 
  isReadOnly = false, 
  candidateProfileId,
  onDocumentsChange 
}: DocumentsTabProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const { toast } = useToast();

  const documentTypes = [
    { value: 'cv', label: 'CV/Resume', required: true },
    { value: 'ktp', label: 'KTP/ID Card', required: true },
    { value: 'ijazah', label: 'Ijazah/Certificate', required: true },
    { value: 'transcript', label: 'Transkrip Nilai', required: false },
    { value: 'portfolio', label: 'Portfolio', required: false },
    { value: 'other', label: 'Lainnya', required: false }
  ];

  useEffect(() => {
    if (candidateProfileId) {
      fetchDocuments();
    } else {
      setLoading(false);
    }
  }, [candidateProfileId]);

  const fetchDocuments = async () => {
    if (!candidateProfileId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidate_documents')
        .select('*')
        .eq('candidate_profile_id', candidateProfileId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        throw error;
      }
      
      const transformedDocuments = (data || []).map(doc => ({
        id: doc.id,
        file_name: doc.file_name,
        file_path: doc.file_path,
        document_type: doc.document_type,
        mime_type: doc.mime_type,
        file_size: doc.file_size,
        uploaded_at: doc.created_at
      }));
      
      setDocuments(transformedDocuments);
      console.log('📄 Documents loaded:', transformedDocuments);
      
      // Trigger callback to parent component to refresh validation data
      if (onDocumentsChange) {
        onDocumentsChange();
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Gagal memuat dokumen",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = event.target.files?.[0];
    if (!file || !candidateProfileId) return;

    console.log('📤 Starting auto file upload:', { fileName: file.name, type: documentType, size: file.size });

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Ukuran file terlalu besar. Maksimal 5MB.",
        variant: "destructive"
      });
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf', 
      'image/jpeg', 
      'image/png', 
      'image/jpg', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Tipe file tidak didukung. Gunakan PDF, DOC, DOCX, atau gambar (JPG, PNG).",
        variant: "destructive"
      });
      return;
    }

    // Check if document type already exists and delete if necessary
    const existingDoc = documents.find(doc => doc.document_type === documentType);
    if (existingDoc) {
      try {
        // Delete existing document from database
        await supabase
          .from('candidate_documents')
          .delete()
          .eq('id', existingDoc.id);
        
        // Delete from storage
        await supabase.storage
          .from('recruitment-files')
          .remove([existingDoc.file_path]);
      } catch (error) {
        console.warn('Error deleting existing document:', error);
      }
    }

    setUploading(prev => ({ ...prev, [documentType]: true }));
    
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${candidateProfileId}/${documentType}_${Date.now()}.${fileExt}`;
      
      console.log('📁 Auto-uploading to path:', fileName);

      // Upload to recruitment-files bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('recruitment-files')
        .upload(fileName, file, {
          cacheControl: '31536000',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError);
        throw uploadError;
      }

      console.log('✅ File uploaded to storage successfully:', uploadData.path);

      // Save document record to database immediately
      const { data: dbData, error: dbError } = await supabase
        .from('candidate_documents')
        .insert({
          candidate_profile_id: candidateProfileId,
          file_name: file.name,
          file_path: uploadData.path,
          mime_type: file.type,
          file_size: file.size,
          document_type: documentType
        })
        .select()
        .single();

      if (dbError) {
        console.error('❌ Database insert error:', dbError);
        // Clean up uploaded file if database insert fails
        await supabase.storage
          .from('recruitment-files')
          .remove([uploadData.path]);
        throw dbError;
      }

      console.log('✅ Document record saved to database successfully:', dbData);

      // Immediately refresh documents to reflect the new upload
      await fetchDocuments();
      
      toast({
        title: "Berhasil Upload!",
        description: `${documentTypes.find(dt => dt.value === documentType)?.label} berhasil disimpan ke sistem.`,
      });

      // Reset file input
      event.target.value = '';
      
    } catch (error) {
      console.error('💥 Auto-upload error:', error);
      toast({
        title: "Gagal Upload",
        description: `Gagal menyimpan ${documentTypes.find(dt => dt.value === documentType)?.label}. Silakan coba lagi.`,
        variant: "destructive"
      });
    } finally {
      setUploading(prev => ({ ...prev, [documentType]: false }));
    }
  };

  const handleDeleteDocument = async (documentId: string, filePath: string) => {
    try {
      console.log('🗑️ Deleting document:', { documentId, filePath });

      // Delete from database
      const { error: dbError } = await supabase
        .from('candidate_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('recruitment-files')
        .remove([filePath]);

      if (storageError) {
        console.warn('Warning: Failed to delete file from storage:', storageError);
      }

      // Refresh documents immediately
      await fetchDocuments();
      
      toast({
        title: "Berhasil",
        description: "Dokumen berhasil dihapus"
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Error",
        description: "Gagal menghapus dokumen",
        variant: "destructive"
      });
    }
  };

  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document);
  };

  const handleDownloadDocument = (filePath: string, fileName: string) => {
    const { data } = supabase.storage
      .from('recruitment-files')
      .getPublicUrl(filePath);
    
    if (data?.publicUrl) {
      const link = document.createElement('a');
      link.href = data.publicUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast({
        title: "Error",
        description: "Gagal mengunduh dokumen",
        variant: "destructive"
      });
    }
  };

  const getDocumentByType = (type: string) => {
    return documents.find(doc => doc.document_type === type);
  };

  const getMissingRequiredDocuments = () => {
    const requiredTypes = documentTypes.filter(dt => dt.required).map(dt => dt.value);
    const uploadedTypes = documents.map(doc => doc.document_type);
    return requiredTypes.filter(type => !uploadedTypes.includes(type));
  };

  if (loading) {
    return (
      <div className="h-full flex">
        <div className="flex-1 p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0">
      {/* Left Panel - Document List */}
      <div className="w-96 border-r border-gray-200 flex-shrink-0">
        <div className="max-h-[600px] overflow-y-auto">
        <Card className="h-full rounded-none border-0">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Dokumen Pendukung</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 px-6">
            {!isReadOnly && (
              <div className="grid grid-cols-1 gap-4">
                {documentTypes.map((docType) => {
                  const existingDoc = getDocumentByType(docType.value);
                  const isUploading = uploading[docType.value];
                  
                  return (
                    <div key={docType.value} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          {docType.label}
                          {docType.required && <span className="text-red-500">*</span>}
                          {existingDoc && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </Label>
                      </div>
                      
                      {existingDoc ? (
                        <div className="space-y-2">
                          <div className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-green-600" />
                              <span className="flex-1 truncate">{existingDoc.file_name}</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDocument(existingDoc)}
                              className="flex-1"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Lihat
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadDocument(existingDoc.file_path, existingDoc.file_name)}
                              className="flex-1"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Unduh
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => existingDoc.id && handleDeleteDocument(existingDoc.id, existingDoc.file_path)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          {/* Replace option */}
                          <div className="mt-2">
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                              onChange={(e) => handleFileUpload(e, docType.value)}
                              className="hidden"
                              id={`replace-${docType.value}`}
                              disabled={isUploading}
                            />
                            <label
                              htmlFor={`replace-${docType.value}`}
                              className="flex items-center gap-2 px-3 py-1 text-xs border border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-500 transition-colors justify-center"
                            >
                              <Upload className="h-3 w-3" />
                              <span>Ganti File</span>
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileUpload(e, docType.value)}
                            className="hidden"
                            id={`upload-${docType.value}`}
                            disabled={isUploading}
                          />
                          <label
                            htmlFor={`upload-${docType.value}`}
                            className={`flex items-center gap-2 px-3 py-2 border border-dashed rounded-md cursor-pointer transition-colors ${
                              isUploading 
                                ? 'border-blue-500 bg-blue-50 cursor-not-allowed' 
                                : docType.required 
                                  ? 'border-red-300 hover:border-red-500' 
                                  : 'border-gray-300 hover:border-blue-500'
                            }`}
                          >
                            {isUploading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                                <span className="text-sm">Mengupload...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4" />
                                <span className="text-sm">Upload File</span>
                              </>
                            )}
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Requirements Summary */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800 mb-2">
                    Status Upload Dokumen:
                  </p>
                  {getMissingRequiredDocuments().length === 0 ? (
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Semua dokumen wajib sudah diupload!</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-2 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm font-medium text-red-800">
                          Dokumen wajib yang belum diupload:
                        </p>
                        <ul className="text-sm text-red-700 mt-1">
                          {getMissingRequiredDocuments().map(type => (
                            <li key={type}>• {documentTypes.find(dt => dt.value === type)?.label}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  <ul className="text-sm text-blue-700 space-y-1 mt-2">
                    <li>• Format yang didukung: PDF, DOC, DOCX, JPG, PNG</li>
                    <li>• Maksimal ukuran file: 5MB per dokumen</li>
                    <li>• File akan tersimpan otomatis setelah upload</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Right Panel - Document Preview - IMPROVED STYLING */}
      <div className="flex-1 bg-white flex flex-col min-w-0 overflow-hidden">
        {selectedDocument ? (
          <div className="h-full flex flex-col">
            <div className="p-4 bg-white border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 break-words">{selectedDocument.file_name}</h3>
                  <p className="text-sm text-gray-500">
                    {documentTypes.find(t => t.value === selectedDocument.document_type)?.label || selectedDocument.document_type}
                  </p>
                </div>
                <div className="flex space-x-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const { data } = supabase.storage
                        .from('recruitment-files')
                        .getPublicUrl(selectedDocument.file_path);
                      
                      if (data?.publicUrl) {
                        window.open(data.publicUrl, '_blank');
                      }
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadDocument(selectedDocument.file_path, selectedDocument.file_name)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex-1 bg-white overflow-hidden">
              <iframe
                src={supabase.storage.from('recruitment-files').getPublicUrl(selectedDocument.file_path).data.publicUrl}
                className="w-full h-full border-0 block"
                title={selectedDocument.file_name}
                style={{ 
                  minHeight: '100%',
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  margin: 0,
                  padding: 0
                }}
                sandbox="allow-same-origin allow-scripts"
                loading="lazy"
              />
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No document selected</p>
              <p className="text-sm">Click on a document to preview it here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
