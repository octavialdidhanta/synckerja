import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { FileText, Upload, Eye, Trash2, Download, CheckCircle, AlertCircle, Edit, Save, X } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { supabase } from '@/shared/lib/supabaseClient';
import { createStorageDisplayUrl } from '@/shared/lib/storageDisplayUrl';
import { normalizeRecruitmentFilesPath } from '@/shared/lib/recruitmentCandidatePhoto';
import { cn } from '@/shared/lib/utils';

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

export const DocumentsTabNew = ({ 
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const { t } = useAppTranslation();

  const documentTypes = [
    { value: 'cv', labelKey: 'candidateProfile.documents.docTypeCv' as const, required: true },
    { value: 'ktp', labelKey: 'candidateProfile.documents.docTypeKtp' as const, required: true },
    { value: 'ijazah', labelKey: 'candidateProfile.documents.docTypeIjazah' as const, required: true },
    { value: 'transcript', labelKey: 'candidateProfile.documents.docTypeTranscript' as const, required: false },
    { value: 'portfolio', labelKey: 'candidateProfile.documents.docTypePortfolio' as const, required: false },
    { value: 'other', labelKey: 'candidateProfile.documents.docTypeOther' as const, required: false }
  ];

  const getDocTypeLabel = (value: string) => {
    const doc = documentTypes.find(dt => dt.value === value);
    return doc ? t(doc.labelKey, doc.value) : value;
  };

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

      if (error) throw error;
      
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
      
      if (onDocumentsChange) {
        onDocumentsChange();
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: t('candidateProfile.documents.toastLoadFailed', 'Failed to load documents'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = event.target.files?.[0];
    if (!file || !candidateProfileId) return;

    // Validate file size (max 2MB - reduced from 5MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: t('candidateProfile.documents.toastFileTooBig', 'File size too large. Maximum 2MB.'),
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
        description: t('candidateProfile.documents.toastFileTypeNotSupported', 'File type not supported. Use PDF, DOC, DOCX, or image (JPG, PNG).'),
        variant: "destructive"
      });
      return;
    }

    // Check if document type already exists and delete if necessary
    const existingDoc = documents.find(doc => doc.document_type === documentType);
    if (existingDoc) {
      try {
        await supabase
          .from('candidate_documents')
          .delete()
          .eq('id', existingDoc.id);
        
        await supabase.storage
          .from('recruitment-files')
          .remove([existingDoc.file_path]);
      } catch (error) {
        console.warn('Error deleting existing document:', error);
      }
    }

    setUploading(prev => ({ ...prev, [documentType]: true }));
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${candidateProfileId}/${documentType}_${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('recruitment-files')
        .upload(fileName, file, {
          cacheControl: '31536000',
          upsert: false
        });

      if (uploadError) throw uploadError;

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
        await supabase.storage
          .from('recruitment-files')
          .remove([uploadData.path]);
        throw dbError;
      }

      await fetchDocuments();
      
      toast({
        title: "Success",
        description: t('candidateProfile.documents.toastUploadSuccessDesc', '{{docType}} saved successfully.', { docType: getDocTypeLabel(documentType) }),
      });

      event.target.value = '';
      
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: t('candidateProfile.documents.toastUploadFailedDesc', 'Failed to save {{docType}}.', { docType: getDocTypeLabel(documentType) }),
        variant: "destructive"
      });
    } finally {
      setUploading(prev => ({ ...prev, [documentType]: false }));
    }
  };

  const handleDeleteDocument = async (documentId: string, filePath: string) => {
    try {
      const { error: dbError } = await supabase
        .from('candidate_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      const { error: storageError } = await supabase.storage
        .from('recruitment-files')
        .remove([filePath]);

      if (storageError) {
        console.warn('Warning: Failed to delete file from storage:', storageError);
      }

      await fetchDocuments();
      
      if (selectedDocument?.id === documentId) {
        setSelectedDocument(null);
        setPreviewUrl(null);
      }
      
      toast({
        title: "Success",
        description: t('candidateProfile.documents.toastDeleted', 'Document deleted successfully')
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Error",
        description: t('candidateProfile.documents.toastDeleteFailed', 'Failed to delete document'),
        variant: "destructive"
      });
    }
  };

  const handleViewDocument = async (document: Document) => {
    setSelectedDocument(document);
    setPreviewUrl(null);
    setPreviewLoading(true);

    try {
      const path = normalizeRecruitmentFilesPath(document.file_path) || document.file_path.trim();
      const signed =
        (await createStorageDisplayUrl('recruitment-files', path, { expiresIn: 3600 })) ??
        (
          await supabase.storage.from('recruitment-files').createSignedUrl(path, 3600)
        ).data?.signedUrl;

      if (!signed) {
        throw new Error('Signed URL unavailable');
      }
      setPreviewUrl(signed);
    } catch (error) {
      console.error('Error creating signed URL:', error);
      setPreviewUrl(null);
      toast({
        title: 'Error',
        description: t(
          'candidateProfile.documents.toastPreviewFailed',
          'Failed to load document preview. Try Open in new tab or Download.',
        ),
        variant: 'destructive',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const isImagePreview = (doc: Document) => {
    if (doc.mime_type?.startsWith('image/')) return true;
    const ext = doc.file_name.split('.').pop()?.toLowerCase();
    return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp';
  };

  const isPdfPreview = (doc: Document) => {
    if (doc.mime_type === 'application/pdf') return true;
    return doc.file_name.toLowerCase().endsWith('.pdf');
  };

  const handleDownloadDocument = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('recruitment-files')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: t('candidateProfile.documents.toastDownloadSuccess', 'Document downloaded successfully.')
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: t('candidateProfile.documents.toastDownloadFailed', 'Failed to download document.'),
        variant: "destructive"
      });
    }
  };

  const getDocumentByType = (type: string) => {
    return documents.find(doc => doc.document_type === type);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    toast({
      title: "Success",
      description: t('candidateProfile.documents.toastSaved', 'Document changes saved successfully')
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>{t('candidateProfile.documents.sectionTitle', 'Supporting Documents')}</span>
          </div>
          <div className="flex items-center space-x-2">
            {!isReadOnly && (
              <>
                {!isEditing ? (
                  <Button onClick={handleEdit} size="sm" variant="outline">
                    <Edit className="h-4 w-4 mr-1" />
                    {t('common.edit', 'Edit')}
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Button onClick={handleCancel} size="sm" variant="outline">
                      <X className="h-4 w-4 mr-1" />
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button onClick={handleSave} size="sm">
                      <Save className="h-4 w-4 mr-1" />
                      {t('common.save', 'Save')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6 h-[600px]">
          {/* Left Panel - Document Types */}
          <div className="w-80 min-h-0 flex-shrink-0 space-y-4 overflow-x-hidden overflow-y-auto scrollbar-hide seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {documentTypes.map((docType) => {
              const existingDoc = getDocumentByType(docType.value);
              const isUploading = uploading[docType.value];
              
              return (
                <div key={docType.value} className="p-4 border border-gray-200 rounded-lg bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{t(docType.labelKey, docType.value)}</h3>
                      {docType.required && <span className="text-red-500">*</span>}
                      {existingDoc && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                  </div>
                  
                  {existingDoc ? (
                    <div className="space-y-3">
                      <div
                        className={cn(
                          'p-3 border rounded-lg transition-colors cursor-pointer',
                          selectedDocument?.id === existingDoc.id
                            ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                            : 'bg-green-50 border-green-200 hover:bg-green-100',
                          isReadOnly && selectedDocument?.id !== existingDoc.id && 'hover:bg-green-50/90',
                        )}
                        onClick={() => void handleViewDocument(existingDoc)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            void handleViewDocument(existingDoc);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800 flex-1 truncate">
                            {existingDoc.file_name}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleViewDocument(existingDoc);
                          }}
                          className="flex-1"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          {t('candidateProfile.documents.view', 'View')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadDocument(existingDoc.file_path, existingDoc.file_name);
                          }}
                          className="flex-1"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          {t('candidateProfile.documents.download', 'Download')}
                        </Button>
                        {(isEditing || !isReadOnly) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (existingDoc.id) {
                                void handleDeleteDocument(existingDoc.id, existingDoc.file_path);
                              }
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {isReadOnly && (
                        <p className="text-xs text-gray-500 text-center">
                          {t('candidateProfile.documents.clickRowToPreview', 'Click the file above to preview')}
                        </p>
                      )}
                      
                      {(isEditing || !isReadOnly) && (
                        <div>
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
                            className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-500 transition-colors justify-center"
                          >
                            <Upload className="h-3 w-3" />
                            <span>{t('candidateProfile.documents.replaceFile', 'Replace File')}</span>
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {(isEditing || !isReadOnly) ? (
                        <>
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
                            className={`flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
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
                                <span className="text-sm">{t('candidateProfile.documents.uploading', 'Uploading...')}</span>
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4" />
                                <span className="text-sm">{t('candidateProfile.documents.uploadFile', 'Upload File')}</span>
                              </>
                            )}
                          </label>
                        </>
                      ) : (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                          <span className="text-sm text-gray-500">{t('candidateProfile.documents.noFileUploaded', 'No file uploaded')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Panel - Document Preview */}
          <div className="flex-1 min-h-0 border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
            {selectedDocument && previewLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : selectedDocument && previewUrl ? (
              <div className="h-full flex flex-col min-h-0">
                <div className="p-4 bg-white border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{selectedDocument.file_name}</h3>
                      <p className="text-sm text-gray-500">
                        {getDocTypeLabel(selectedDocument.document_type)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(previewUrl, '_blank')}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {t('candidateProfile.documents.open', 'Open')}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-auto scrollbar-hide seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {isImagePreview(selectedDocument) ? (
                    <div className="flex h-full min-h-[400px] items-center justify-center p-4 bg-gray-100">
                      <img
                        src={previewUrl}
                        alt={selectedDocument.file_name}
                        className="max-h-full max-w-full object-contain rounded shadow-sm"
                      />
                    </div>
                  ) : isPdfPreview(selectedDocument) ? (
                    <iframe
                      src={previewUrl}
                      className="h-full min-h-[480px] w-full border-0"
                      title={selectedDocument.file_name}
                    />
                  ) : (
                    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-6 text-center text-gray-600">
                      <FileText className="h-10 w-10 text-gray-400" />
                      <p className="text-sm">
                        {t(
                          'candidateProfile.documents.previewNotInline',
                          'Preview is not available for this file type. Open or download the file.',
                        )}
                      </p>
                      <Button size="sm" variant="outline" onClick={() => window.open(previewUrl, '_blank')}>
                        <Eye className="h-4 w-4 mr-1" />
                        {t('candidateProfile.documents.open', 'Open')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : selectedDocument && !previewUrl && !previewLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center text-gray-500">
                <AlertCircle className="h-10 w-10 text-amber-500" />
                <p className="text-sm">
                  {t('candidateProfile.documents.previewLoadFailed', 'Could not load preview. Try Download or Open.')}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadDocument(selectedDocument.file_path, selectedDocument.file_name)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  {t('candidateProfile.documents.download', 'Download')}
                </Button>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">{t('candidateProfile.documents.noDocumentSelected', 'No document selected')}</p>
                  <p className="text-sm">{t('candidateProfile.documents.clickToPreview', 'Click on a document to preview it here')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
