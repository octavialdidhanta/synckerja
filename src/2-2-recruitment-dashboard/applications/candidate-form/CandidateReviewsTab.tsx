import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Textarea } from '@/shared/components/ui/textarea';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Star, Plus, MessageSquare, Award, ThumbsUp, UserPlus, Lock, CheckCircle, AlertTriangle, Loader2, MoreVertical, Edit, Trash2, FileText, ExternalLink, Download, Minus, Maximize2, RotateCw, ChevronDown } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useCurrentUserRole } from '@/shared/hooks/useCurrentUserRole';
// import { DocumentPreview } from '@/components/DocumentPreview'; // TODO: Implement DocumentPreview component

interface CandidateReviewsTabProps {
  candidateProfileId?: string;
  cvFilePath?: string;
  candidateName?: string;
}

interface Review {
  id: string;
  question_review_id: string;
  question_review?: {
    id: string;
    question_text: string;
    review_category_id: string;
  };
  reviewer_id: string;
  rating: number;
  review_text?: string;
  review_category_id: string;
  review_category?: {
    id: string;
    name: string;
    description: string;
  };
  is_recommendation: boolean;
  created_at: string;
  updated_at: string;
}

interface DocumentFile {
  id: string;
  file_name: string;
  file_path: string;
  document_type: string;
  mime_type?: string;
}

interface QuestionReview {
  id: string;
  question_text: string;
  review_category_id: string;
  is_default: boolean;
  is_active: boolean;
  sort_order?: number;
}

// Static review categories mapping for question categorization
const staticReviewCategories = [{
  value: 'general',
  label: 'Umum',
  description: 'Penilaian keseluruhan dan feedback umum'
}, {
  value: 'technical',
  label: 'Keterampilan Teknis',
  description: 'Evaluasi keahlian dan keterampilan teknis'
}, {
  value: 'communication',
  label: 'Komunikasi',
  description: 'Kemampuan komunikasi dan keterampilan interpersonal'
}, {
  value: 'leadership',
  label: 'Kepemimpinan',
  description: 'Potensi kepemimpinan dan kemampuan manajerial'
}, {
  value: 'teamwork',
  label: 'Kerja Tim',
  description: 'Kolaborasi dan keterampilan interpersonal'
}, {
  value: 'problem_solving',
  label: 'Pemecahan Masalah',
  description: 'Pemikiran analitis dan pendekatan berorientasi solusi'
}, {
  value: 'policy_compliance',
  label: 'Kepatuhan Kebijakan',
  description: 'Kepatuhan terhadap kebijakan perusahaan'
}, {
  value: 'reliability',
  label: 'Keandalan',
  description: 'Konsistensi dan dapat diandalkan'
}, {
  value: 'quality',
  label: 'Kualitas',
  description: 'Penilaian akurasi kerja dan standar'
}, {
  value: 'job_knowledge',
  label: 'Pengetahuan Pekerjaan',
  description: 'Evaluasi keahlian dan keterampilan teknis'
}, {
  value: 'attitude_attendance',
  label: 'Sikap & Kehadiran',
  description: 'Ketepatan waktu dan perilaku profesional'
}, {
  value: 'productivity',
  label: 'Produktivitas',
  description: 'Penilaian efisiensi dan output'
}, {
  value: 'initiative_creativity',
  label: 'Inisiatif/Kreativitas',
  description: 'Motivasi diri dan pemikiran inovatif'
}, {
  value: 'other',
  label: 'Lainnya',
  description: 'Kriteria evaluasi tambahan'
}];

export const CandidateReviewsTab = ({
  candidateProfileId,
  cvFilePath,
  candidateName
}: CandidateReviewsTabProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [averageScore, setAverageScore] = useState(0);
  const [migrating, setMigrating] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [newReview, setNewReview] = useState({
    question_review_id: '',
    rating: 5,
    review_text: '',
    review_category_id: '',
    is_recommendation: false
  });
  const [reviewCategories, setReviewCategories] = useState<{id: string, name: string, description: string}[]>([]);
  const [questionReviews, setQuestionReviews] = useState<QuestionReview[]>([]);
  const [isEditQuestionDialogOpen, setIsEditQuestionDialogOpen] = useState(false);
  const [editedQuestionText, setEditedQuestionText] = useState('');
  const [isAddQuestionDialogOpen, setIsAddQuestionDialogOpen] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const { toast } = useToast();
  const { data: userRole } = useCurrentUserRole();

  // Check if user is interviewer (admin or owner)
  const isInterviewer = userRole === 'admin' || userRole === 'owner';

  useEffect(() => {
    if (candidateProfileId && isInterviewer) {
      loadReviewCategories();
      loadQuestionReviews();
      loadReviews();
      loadDocuments();
    }
  }, [candidateProfileId, isInterviewer]);

  const loadReviewCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('review_category')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error loading review categories:', error);
        return;
      }

      setReviewCategories(data || []);
      
      // Set default category for new review if categories are loaded and no category is selected
      if (data && data.length > 0 && !newReview.review_category_id) {
        const defaultCategory = data.find(cat => cat.name === 'general') || data[0];
        setNewReview(prev => ({ ...prev, review_category_id: defaultCategory.id }));
      }
    } catch (error) {
      console.error('Error loading review categories:', error);
    }
  };

  const loadQuestionReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('question_review')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error loading question reviews:', error);
        return;
      }

      setQuestionReviews(data || []);
    } catch (error) {
      console.error('Error loading question reviews:', error);
    }
  };

  const loadReviews = async () => {
    if (!candidateProfileId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidate_reviews')
        .select(`
          *,
          review_category:review_category_id (
            id,
            name,
            description
          ),
          question_review:question_review_id (
            id,
            question_text,
            review_category_id
          )
        `)
        .eq('candidate_profile_id', candidateProfileId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading reviews:', error);
        return;
      }

      setReviews(data || []);

      // Calculate average score
      if (data && data.length > 0) {
        const totalRating = data.reduce((sum, review) => sum + review.rating, 0);
        const average = totalRating / data.length;
        setAverageScore(Math.round(average / 5 * 100)); // Convert to percentage
      } else {
        setAverageScore(0);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    if (!candidateProfileId) return;
    try {
      const { data, error } = await supabase
        .from('candidate_documents')
        .select('*')
        .eq('candidate_profile_id', candidateProfileId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading documents:', error);
        return;
      }

      setDocuments(data || []);
      
      // Auto-select first document if available
      if (data && data.length > 0 && !selectedDocument) {
        handleDocumentSelect(data[0]);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const handleDocumentSelect = async (document: DocumentFile) => {
    setSelectedDocument(document);
    setIsLoadingDocument(true);
    setPreviewUrl(null);

    try {
      // Documents are stored in recruitment-files bucket
      const { data, error } = await supabase.storage
        .from('recruitment-files')
        .createSignedUrl(document.file_path, 3600); // 1 hour expiry

      if (error) {
        console.error('Error loading document preview:', error);
        toast({
          title: 'Error',
          description: 'Failed to load document preview. Please check if the file exists.',
          variant: 'destructive'
        });
        setPreviewUrl(null);
        return;
      }

      setPreviewUrl(data.signedUrl);
    } catch (error: any) {
      console.error('Error generating document preview URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate document preview URL',
        variant: 'destructive'
      });
      setPreviewUrl(null);
    } finally {
      setIsLoadingDocument(false);
    }
  };

  const handleDownloadDocument = async (doc: DocumentFile) => {
    if (!previewUrl || selectedDocument?.id !== doc.id) {
      // Generate signed URL if not already loaded
      try {
        const { data, error } = await supabase.storage
          .from('recruitment-files')
          .createSignedUrl(doc.file_path, 3600);

        if (error) throw error;

        const url = data.signedUrl;
        const response = await fetch(url);
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = downloadUrl;
        a.download = doc.file_name || doc.file_path.split('/').pop() || 'document.pdf';
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        toast({
          title: 'Success',
          description: 'Document downloaded successfully'
        });
      } catch (error: any) {
        toast({
          title: 'Error',
          description: 'Failed to download document',
          variant: 'destructive'
        });
      }
    } else {
      // Use existing preview URL
      try {
        const response = await fetch(previewUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = doc.file_name || doc.file_path.split('/').pop() || 'document.pdf';
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: 'Success',
          description: 'Document downloaded successfully'
        });
      } catch (error: any) {
        toast({
          title: 'Error',
          description: 'Failed to download document',
          variant: 'destructive'
        });
      }
    }
  };

  const handleAddReview = async () => {
    if (!candidateProfileId || !newReview.question_review_id.trim()) {
      toast({
        title: 'Error',
        description: 'Please select a question.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Get current user ID or use a default UUID for anonymous reviews
      const { data: { user } } = await supabase.auth.getUser();
      const reviewerId = user?.id || '00000000-0000-0000-0000-000000000000';
      
      // Get reviewer name from user email or use default
      let reviewerName = 'Anonymous Reviewer';
      if (user?.email) {
        reviewerName = user.email.split('@')[0] || 'Anonymous Reviewer';
      }

      const { error } = await supabase
        .from('candidate_reviews')
        .insert({
          candidate_profile_id: candidateProfileId,
          question_review_id: newReview.question_review_id,
          reviewer_id: reviewerId,
          reviewer_name: reviewerName,
          rating: newReview.rating,
          review_text: newReview.review_text || null,
          review_category_id: newReview.review_category_id,
          is_recommendation: newReview.is_recommendation
        });

      if (error) {
        throw error;
      }

      // Reset form
      const defaultCategory = reviewCategories.find(cat => cat.name === 'general') || reviewCategories[0];
      setNewReview({
        question_review_id: '',
        rating: 5,
        review_text: '',
        review_category_id: defaultCategory?.id || '',
        is_recommendation: false
      });
      setShowAddForm(false);
      loadReviews(); // Reload to update the list and score

      toast({
        title: 'Success',
        description: 'Review added successfully.'
      });
    } catch (error: any) {
      console.error('Error adding review:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add review.',
        variant: 'destructive'
      });
    }
  };

  const handleQuestionSelect = (questionId: string) => {
    // Find the selected question
    const selectedQuestion = questionReviews.find(q => q.id === questionId);
    
    if (selectedQuestion) {
      setNewReview({
        ...newReview,
        question_review_id: questionId,
        review_category_id: selectedQuestion.review_category_id
      });
    }
  };

  // Get filtered questions based on selected category
  const getFilteredQuestions = () => {
    if (!newReview.review_category_id) return [];
    return questionReviews.filter(q => q.review_category_id === newReview.review_category_id);
  };

  // Handle adding new question
  const handleAddNewQuestion = async () => {
    if (!newQuestionText.trim() || !newReview.review_category_id) {
      toast({
        title: 'Error',
        description: 'Please enter a question text and select a category.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Get user's organization ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.active_organization_id) throw new Error('No active organization found');

      const { data, error } = await supabase
        .from('question_review')
        .insert({
          question_text: newQuestionText.trim(),
          review_category_id: newReview.review_category_id,
          organization_id: profile.active_organization_id,
          is_default: false,
          is_active: true,
          sort_order: 999
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setQuestionReviews(prev => [...prev, data]);
      
      // Set the new question as selected
      setNewReview(prev => ({ ...prev, question_review_id: data.id }));

      // Reset form and close dialog
      setNewQuestionText('');
      setIsAddQuestionDialogOpen(false);

      toast({
        title: 'Berhasil',
        description: 'Pertanyaan baru berhasil ditambahkan.'
      });
    } catch (error: any) {
      console.error('Error adding question:', error);
      toast({
        title: 'Error',
        description: error.message || 'Gagal menambahkan pertanyaan baru.',
        variant: 'destructive'
      });
    }
  };

  // Handle custom question management (add, edit, delete)
  const handleCustomQuestion = async (action: 'add' | 'edit' | 'delete') => {
    switch (action) {
      case 'add':
        if (!newReview.review_category_id) {
          toast({
            title: 'Pilih Kategori',
            description: 'Silakan pilih kategori terlebih dahulu sebelum menambah pertanyaan.',
            variant: 'destructive'
          });
          return;
        }
        setIsAddQuestionDialogOpen(true);
        break;

      case 'edit':
        if (!newReview.question_review_id) {
          toast({
            title: 'Pilih Pertanyaan',
            description: 'Silakan pilih pertanyaan yang ingin diedit.',
            variant: 'destructive'
          });
          return;
        }

        const selectedQuestion = questionReviews.find(q => q.id === newReview.question_review_id);
        if (!selectedQuestion) return;

        if (selectedQuestion.is_default) {
          toast({
            title: 'Tidak Dapat Diedit',
            description: 'Pertanyaan default tidak dapat diedit.',
            variant: 'destructive'
          });
          return;
        }

        setEditedQuestionText(selectedQuestion.question_text);
        setIsEditQuestionDialogOpen(true);
        break;

      case 'delete':
        if (!newReview.question_review_id) {
          toast({
            title: 'Pilih Pertanyaan',
            description: 'Silakan pilih pertanyaan yang ingin dihapus.',
            variant: 'destructive'
          });
          return;
        }

        const questionToDelete = questionReviews.find(q => q.id === newReview.question_review_id);
        if (!questionToDelete) return;

        if (questionToDelete.is_default) {
          toast({
            title: 'Tidak Dapat Dihapus',
            description: 'Pertanyaan default tidak dapat dihapus.',
            variant: 'destructive'
          });
          return;
        }

        if (confirm(`Apakah Anda yakin ingin menghapus pertanyaan: "${questionToDelete.question_text}"?`)) {
          try {
            const { error } = await supabase
              .from('question_review')
              .update({ is_active: false })
              .eq('id', questionToDelete.id);

            if (error) throw error;

            // Update local state
            setQuestionReviews(prev => prev.filter(q => q.id !== questionToDelete.id));
            
            // Clear selection
            setNewReview(prev => ({ ...prev, question_review_id: '' }));

            toast({
              title: 'Berhasil',
              description: 'Pertanyaan berhasil dihapus.'
            });
          } catch (error: any) {
            console.error('Error deleting question:', error);
            toast({
              title: 'Error',
              description: 'Gagal menghapus pertanyaan.',
              variant: 'destructive'
            });
          }
        }
        break;
    }
  };

  // Handle editing question
  const handleEditQuestion = async () => {
    if (!editedQuestionText.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a question text.',
        variant: 'destructive'
      });
      return;
    }

    const selectedQuestion = questionReviews.find(q => q.id === newReview.question_review_id);
    if (!selectedQuestion) return;

    try {
      const { error } = await supabase
        .from('question_review')
        .update({ question_text: editedQuestionText.trim() })
        .eq('id', selectedQuestion.id);

      if (error) throw error;

      // Update local state
      setQuestionReviews(prev => 
        prev.map(q => 
          q.id === selectedQuestion.id 
            ? { ...q, question_text: editedQuestionText.trim() }
            : q
        )
      );

      setEditedQuestionText('');
      setIsEditQuestionDialogOpen(false);

      toast({
        title: 'Berhasil',
        description: 'Pertanyaan berhasil diperbarui.'
      });
    } catch (error: any) {
      console.error('Error editing question:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengedit pertanyaan.',
        variant: 'destructive'
      });
    }
  };

  const handleAddAsEmployee = async () => {
    if (!candidateProfileId) return;

    // Check if there are any reviews first
    if (reviews.length === 0) {
      toast({
        title: "Reviews Required",
        description: "Kandidat harus memiliki minimal 1 review sebelum dapat dijadikan karyawan. Silakan tambahkan review terlebih dahulu.",
        variant: "destructive"
      });
      return;
    }

    setMigrating(true);
    console.log('[FRONTEND] Starting candidate to employee migration for:', candidateProfileId);

    // Show initial processing toast
    toast({
      title: 'Processing Migration',
      description: 'Starting candidate migration to employee...'
    });

    try {
      // Get user's organization ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.active_organization_id) throw new Error('No active organization found');

      console.log('[FRONTEND] Calling migrate-candidate-to-employee function...');
      const { data, error } = await supabase.functions.invoke('migrate-candidate-to-employee', {
        body: { 
          candidateProfileId,
          organizationId: profile.active_organization_id
        }
      });

      console.log('[FRONTEND] Migration response:', { data, error });

      if (error) {
        console.error('[FRONTEND] Migration error:', error);
        throw new Error(error.message || 'Migration failed');
      }

      if (data?.success) {
        console.log('[FRONTEND] Migration successful:', data);

        // Show detailed success toast
        if (data.magicLinkSent) {
          toast({
            title: 'Migration Successful! ✅',
            description: (
              <div className="space-y-2">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Candidate successfully migrated to employee!</p>
                    <div className="text-sm text-gray-600 mt-1 space-y-1">
                      <div><strong>Employee ID:</strong> {data.employeeId}</div>
                      <div><strong>Name:</strong> {data.candidateName}</div>
                      <div><strong>Email:</strong> {data.candidateEmail}</div>
                      <div className="text-green-600"><strong>✓ Invitation email sent successfully</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            ),
            className: "border-green-200 bg-green-50"
          });
        } else {
          toast({
            title: 'Migration Completed with Warning ⚠️',
            description: (
              <div className="space-y-2">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Employee created successfully!</p>
                    <div className="text-sm text-gray-600 mt-1 space-y-1">
                      <div><strong>Employee ID:</strong> {data.employeeId}</div>
                      <div><strong>Name:</strong> {data.candidateName}</div>
                      <div><strong>Email:</strong> {data.candidateEmail}</div>
                      <div className="text-amber-600"><strong>⚠ Warning:</strong> Invitation email failed to send</div>
                      {data.emailError && <div className="text-xs text-gray-500">Error: {data.emailError}</div>}
                    </div>
                  </div>
                </div>
              </div>
            ),
            className: "border-amber-200 bg-amber-50"
          });
        }

        await Promise.all([loadReviews(), loadDocuments()]);
      } else {
        console.error('[FRONTEND] Migration failed:', data);
        throw new Error(data?.error || 'Migration failed for unknown reason');
      }
    } catch (error: any) {
      console.error('[FRONTEND] Error migrating candidate:', error);

      // Show detailed error toast
      toast({
        title: 'Migration Failed ❌',
        description: (
          <div className="space-y-2">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Failed to migrate candidate to employee</p>
                <div className="text-sm text-gray-600 mt-1">
                  <div><strong>Error:</strong> {error.message || 'Unknown error occurred'}</div>
                  {error.step && <div className="text-xs text-gray-500 mt-1">Failed at step: {error.step}</div>}
                  {error.details && <div className="text-xs text-gray-500">Details: {error.details}</div>}
                </div>
              </div>
            </div>
          </div>
        ),
        variant: 'destructive',
        className: "border-red-200 bg-red-50"
      });
    } finally {
      setMigrating(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star key={index} className={`h-4 w-4 ${index < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
    ));
  };

  const getSelectedCategoryDescription = () => {
    const category = reviewCategories.find(cat => cat.id === newReview.review_category_id);
    return category?.description || '';
  };

  // Show access denied for non-interviewers
  if (!isInterviewer) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
        <p className="text-gray-600 max-w-md">
          This reviews section is only accessible to interviewers and administrators. 
          Candidates cannot view or add reviews.
        </p>
      </div>
    );
  }

  if (!candidateProfileId) {
    return (
      <div className="text-center py-12 text-gray-500">
        Please save the candidate profile first to view and add reviews.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 max-h-[calc(100vh-120px)]">
      {/* Left Section - Reviews & Score (35% width) */}
      <div className="w-[35%] space-y-4 overflow-y-auto pr-4 seamless-scroll">
        {/* Score Overview & Actions */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                <span className="text-lg">Candidate Reviews</span>
              </div>
              
              {/* Add as Employee Button - Only show if there are reviews */}
              {reviews.length > 0 && (
                <Button 
                  onClick={handleAddAsEmployee}
                  disabled={migrating}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  {migrating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add as Employee
                    </>
                  )}
                </Button>
              )}
            </CardTitle>
            {/* Score moved below title with smaller text */}
            <div className={`flex items-center justify-center px-3 py-1.5 rounded-full border text-sm font-medium ${getScoreColor(averageScore)} w-fit mt-2`}>
              <Star className="h-4 w-4 mr-2" />
              Score: {averageScore}/100
            </div>
            
            {/* Reviews Required Notice */}
            {reviews.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Reviews Required</p>
                    <p className="text-amber-700">Minimal 1 review diperlukan sebelum kandidat dapat dijadikan karyawan.</p>
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold text-gray-900 mb-1">{reviews.length}</div>
                <div className="text-xs text-gray-600">Total Reviews</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold text-gray-900 mb-1">
                  {reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : '0.0'}
                </div>
                <div className="text-xs text-gray-600">Average Rating</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold text-gray-900 mb-1">
                  {reviews.filter(r => r.is_recommendation).length}
                </div>
                <div className="text-xs text-gray-600">Recommendations</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Review Button */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Reviews & Feedback</h3>
          <Button onClick={() => setShowAddForm(!showAddForm)} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Review
          </Button>
        </div>

        {/* Add Review Form */}
        {showAddForm && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add New Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Category field - First */}
              <div className="space-y-2">
                <label className="block text-sm font-medium">Kategori</label>
                <Select 
                  value={newReview.review_category_id} 
                  onValueChange={value => setNewReview({ 
                    ...newReview, 
                    review_category_id: value,
                    question_review_id: '' // Reset question when category changes
                  })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {reviewCategories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getSelectedCategoryDescription() && (
                  <p className="text-xs text-gray-500">{getSelectedCategoryDescription()}</p>
                )}
              </div>

              {/* Criteria Question field - Second (dependent on category) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium">Pertanyaan Kriteria</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleCustomQuestion('add')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Tambah Pertanyaan
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleCustomQuestion('edit')}
                        disabled={!newReview.question_review_id}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Pertanyaan
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleCustomQuestion('delete')}
                        disabled={!newReview.question_review_id}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Hapus Pertanyaan
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Select 
                  value={newReview.question_review_id} 
                  onValueChange={value => setNewReview({ ...newReview, question_review_id: value })}
                  disabled={!newReview.review_category_id}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder={
                      !newReview.review_category_id 
                        ? "Pilih kategori terlebih dahulu" 
                        : "Pilih pertanyaan wawancara"
                    } />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {getFilteredQuestions().map((question) => (
                      <SelectItem key={question.id} value={question.id}>
                        <div className="max-w-[400px] break-words">
                          {question.question_text}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!newReview.review_category_id && (
                  <p className="text-xs text-gray-500">Silakan pilih kategori terlebih dahulu untuk melihat pertanyaan yang tersedia.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Rating</label>
                <div className="flex items-center space-x-2">
                  {Array.from({ length: 5 }, (_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setNewReview({ ...newReview, rating: index + 1 })}
                    >
                      <Star className={`h-5 w-5 cursor-pointer ${index < newReview.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-gray-600">({newReview.rating}/5)</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Review Text</label>
                <Textarea
                  value={newReview.review_text}
                  onChange={e => setNewReview({ ...newReview, review_text: e.target.value })}
                  placeholder="Tulis review Anda di sini..."
                  rows={3}
                  className="text-sm"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="recommendation"
                  checked={newReview.is_recommendation}
                  onChange={e => setNewReview({ ...newReview, is_recommendation: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="recommendation" className="text-sm text-gray-700">
                  Ini adalah rekomendasi
                </label>
              </div>

              <div className="flex space-x-2 pt-2">
                 <Button 
                   onClick={handleAddReview} 
                   disabled={!newReview.question_review_id.trim()}
                   size="sm"
                 >
                   Add Review
                 </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)} size="sm">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reviews List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : reviews.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-gray-500">
                <MessageSquare className="h-8 w-8 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No reviews yet</p>
                <p className="text-sm mt-1">Be the first to add a review for this candidate</p>
              </CardContent>
            </Card>
          ) : (
            reviews.map(review => (
              <Card key={review.id} className="shadow-sm">
                <CardContent className="p-3">
                  <div className="mb-2">
                    <div className="font-medium text-sm mb-1">{review.question_review?.question_text || 'Question not found'}</div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-500 capitalize">
                      {review.review_category?.name || 'Unknown Category'}
                    </div>
                    {review.is_recommendation && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                        <ThumbsUp className="h-3 w-3 mr-1" />
                        Recommended
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center mb-2">
                    <div className="flex items-center space-x-1">
                      {renderStars(review.rating)}
                    </div>
                    <span className="ml-2 text-xs text-gray-600">({review.rating}/5)</span>
                  </div>

                  {review.review_text && (
                    <div className="bg-gray-50 p-2 rounded-lg">
                      <p className="text-gray-700 text-sm leading-relaxed">{review.review_text}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Right Section - Document Preview (65% width) */}
      <div className="w-[65%] flex flex-col min-h-0">
        <Card className="flex flex-col h-full min-h-0">
          <CardHeader className="flex-shrink-0 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents {candidateName && `- ${candidateName}`}
              </CardTitle>
              {selectedDocument && previewUrl && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(previewUrl, '_blank')}
                    className="h-8"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadDocument(selectedDocument)}
                    className="h-8"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 p-0">
            {documents.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No documents uploaded</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full min-h-0">
                {/* Document Preview Area */}
                <div className="flex-1 flex flex-col min-h-0">
                  {isLoadingDocument ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-500">Loading document...</p>
                      </div>
                    </div>
                  ) : !selectedDocument ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Select a document to preview</p>
                      </div>
                    </div>
                  ) : previewUrl ? (
                    <div className="flex flex-col h-full min-h-0">
                      {/* Document Controls */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 border-b flex-shrink-0">
                        <div className="flex items-center gap-2">
                          {/* Document List Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                <span className="text-xs">
                                  {selectedDocument?.file_name ? (
                                    <>
                                      {selectedDocument.file_name.length > 20 
                                        ? `${selectedDocument.file_name.substring(0, 20)}...` 
                                        : selectedDocument.file_name}
                                      <span className="text-gray-500 ml-1">({selectedDocument.document_type})</span>
                                    </>
                                  ) : (
                                    'Select Document'
                                  )}
                                </span>
                                <ChevronDown className="h-3 w-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-64 max-h-96 overflow-y-auto">
                              {documents.map((doc) => (
                                <DropdownMenuItem
                                  key={doc.id}
                                  onClick={() => handleDocumentSelect(doc)}
                                  className={`flex items-start gap-2 p-2 cursor-pointer ${
                                    selectedDocument?.id === doc.id
                                      ? 'bg-blue-50 text-blue-700'
                                      : ''
                                  }`}
                                >
                                  <FileText className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                                    selectedDocument?.id === doc.id ? 'text-blue-600' : 'text-gray-400'
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <p className={`font-medium text-sm ${
                                      selectedDocument?.id === doc.id ? 'text-blue-700' : 'text-gray-900'
                                    }`}>
                                      {doc.file_name || 'Untitled'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5 capitalize">
                                      {doc.document_type}
                                    </p>
                                  </div>
                                  {selectedDocument?.id === doc.id && (
                                    <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                  )}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          
                          <span className="text-xs text-gray-500">
                            {documents.findIndex(d => d.id === selectedDocument.id) + 1} / {documents.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setZoomLevel(prev => Math.max(25, prev - 10))}
                            disabled={zoomLevel <= 25}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="text-xs font-medium w-12 text-center">{zoomLevel}%</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setZoomLevel(prev => Math.min(200, prev + 10))}
                            disabled={zoomLevel >= 200}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <div className="w-px h-4 bg-gray-300 mx-1"></div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              const iframe = document.querySelector('iframe[title="Document Preview"]') as HTMLIFrameElement;
                              if (iframe) {
                                const currentRotation = parseInt(iframe.style.transform.replace('rotate(', '').replace('deg)', '')) || 0;
                                iframe.style.transform = `rotate(${currentRotation + 90}deg)`;
                              }
                            }}
                            title="Rotate"
                          >
                            <RotateCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setZoomLevel(100)}
                            title="Fit to page"
                          >
                            <Maximize2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {/* Document Viewer */}
                      <div className="flex-1 overflow-auto bg-gray-100 p-4 min-h-0 seamless-scroll" style={{ position: 'relative' }}>
                        <div className="bg-white shadow-lg mx-auto absolute inset-4" style={{ width: `${Math.max(zoomLevel, 100)}%`, transition: 'width 0.2s' }}>
                          <iframe
                            src={previewUrl}
                            className="w-full border-0"
                            style={{ minHeight: '600px', height: '100%', width: '100%', display: 'block' }}
                            title="Document Preview"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Failed to load document preview</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Question Dialog */}
      <Dialog open={isAddQuestionDialogOpen} onOpenChange={setIsAddQuestionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Pertanyaan Baru</DialogTitle>
            <DialogDescription>
              Masukkan pertanyaan baru untuk kategori yang dipilih.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Teks Pertanyaan</label>
              <Textarea
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="Masukkan pertanyaan baru..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddQuestionDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleAddNewQuestion} disabled={!newQuestionText.trim()}>
              Tambah Pertanyaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={isEditQuestionDialogOpen} onOpenChange={setIsEditQuestionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pertanyaan</DialogTitle>
            <DialogDescription>
              Edit teks pertanyaan yang dipilih.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Teks Pertanyaan</label>
              <Textarea
                value={editedQuestionText}
                onChange={(e) => setEditedQuestionText(e.target.value)}
                placeholder="Edit pertanyaan..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditQuestionDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleEditQuestion} disabled={!editedQuestionText.trim()}>
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
