import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { cn } from '@/shared/lib/utils';
import { ArrowLeft, Check, ExternalLink, LinkIcon, Tag, Calendar, MessageSquare, Send, Briefcase, Layers, Pencil, RotateCcw, Trash2, User, Loader2, Download } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { defaultTranslations, applyVariables } from '@/shared/i18n/translations';
import { devLog } from '@/shared/lib/logger';
import { getEmbedUrl, getDirectVideoUrl, isFolderLink, isFileLink, isYouTubeLink } from '../utils/previewUtils';
import { getCarouselImagePublicUrl } from '../hook/useCarouselImages';
import GoogleDriveFolderCarousel from '../modal/GoogleDriveFolderCarousel';
import { useProdApprovalAccess } from '../hook/useProdApprovalAccess';
import { useAuth } from '@/shared/auth/contexts/AuthContext';
import { useUnifiedProfile } from '@/shared/hooks/useUnifiedProfile';
import { useSafeAreaInsets } from '@/mobile/contexts/SafeAreaInsetsContext';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { revertStepCompletionFromDriveLinkRemovalWithRpc } from '@/8-2-DailyTask/services/completionApprovalService';

const REVIEW_COMMENTER_STORAGE_KEY = 'review_commenter_';

const LOAD_TIMEOUT_MS = 20000;

function withTimeoutAndCancel<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): { promise: Promise<T>; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return {
    promise: Promise.race([promise, timeoutPromise]),
    cancel: () => clearTimeout(timeoutId!),
  };
}

interface PublicReviewContent {
  social_media_plan_id: string;
  link_url: string;
  title: string | null;
  post_date: string | null;
  google_drive_link: string | null;
  content_type_name: string | null;
  service_name: string | null;
  sub_service_name: string | null;
  pic_production_name: string | null;
  carousel_image_paths?: string[];
}

interface PublicReviewComment {
  id: string;
  comment_text: string | null;
  created_at: string | null;
  created_by: string | null;
  creator_display_name: string;
  video_timestamp_seconds: number | null;
  annotation_data: Record<string, unknown> | null;
}

/** From RPC get_public_review_brief_extended_by_token (token-scoped; no cross-org leak) */
interface PublicReviewBriefExtended {
  target_audience: string;
  caption: string;
}

/** Warna unik per komentar (berdasarkan id) untuk membedakan tiap caption. */
const COMMENT_ACCENT_COLORS = [
  { border: 'border-l-blue-500', bg: 'bg-blue-50/80' },
  { border: 'border-l-emerald-500', bg: 'bg-emerald-50/80' },
  { border: 'border-l-amber-500', bg: 'bg-amber-50/80' },
  { border: 'border-l-violet-500', bg: 'bg-violet-50/80' },
  { border: 'border-l-rose-500', bg: 'bg-rose-50/80' },
  { border: 'border-l-cyan-500', bg: 'bg-cyan-50/80' },
  { border: 'border-l-orange-500', bg: 'bg-orange-50/80' },
  { border: 'border-l-teal-500', bg: 'bg-teal-50/80' },
  { border: 'border-l-fuchsia-500', bg: 'bg-fuchsia-50/80' },
  { border: 'border-l-sky-500', bg: 'bg-sky-50/80' },
] as const;

function getCommentAccent(commentId: string): (typeof COMMENT_ACCENT_COLORS)[number] {
  let hash = 0;
  for (let i = 0; i < commentId.length; i++) {
    hash = (hash << 5) - hash + commentId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COMMENT_ACCENT_COLORS.length;
  return COMMENT_ACCENT_COLORS[index];
}

/** Portrait-oriented content types (Reel, Story, Shorts, etc.) use 9/16 aspect ratio. When unknown, default to portrait to avoid cropping vertical content. */
function isPortraitContent(contentTypeName: string | null | undefined): boolean {
  if (contentTypeName == null || String(contentTypeName).trim() === '') return true; // default portrait so Reel/vertical is not cropped
  const n = String(contentTypeName).toLowerCase();
  // Portrait keywords take precedence (e.g. "Reel" or "Content X - Reel" must stay portrait)
  if (n.includes('reel') || n.includes('story') || n.includes('shorts') || n.includes('tiktok') || n.includes('vertical')) return true;
  if (n.includes('landscape') || n.includes('horizontal') || n.includes('youtube')) return false;
  // "video" alone can be landscape; avoid treating "Reel - video" as landscape
  return false;
}

/** Public review page always uses English (shared link may be opened without app/Settings). */
function usePublicReviewT() {
  return useCallback(
    (key: string, fallback: string, variables?: Record<string, string | number>) => {
      const localized = defaultTranslations.en?.[key] ?? fallback;
      return applyVariables(localized, variables);
    },
    [],
  );
}

interface PublicContentReviewPageProps {
  showBackToHome?: boolean;
}

const PublicContentReviewPage: React.FC<PublicContentReviewPageProps> = ({ showBackToHome = false }) => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const t = usePublicReviewT();
  const safeArea = useSafeAreaInsets();
  const [content, setContent] = useState<PublicReviewContent | null>(null);
  const [briefExtended, setBriefExtended] = useState<PublicReviewBriefExtended | null>(null);
  const [comments, setComments] = useState<PublicReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commenterDisplayName, setCommenterDisplayName] = useState('');
  const [showCommenterPopup, setShowCommenterPopup] = useState(false);
  const [popupNameInput, setPopupNameInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [videoUseIframe, setVideoUseIframe] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [carouselPreviewIndex, setCarouselPreviewIndex] = useState(0);
  const [carouselDownloading, setCarouselDownloading] = useState(false);
  /** True only after user has successfully sent at least one comment this session (enables Request Revision) */
  const [hasSuccessfullySentCommentThisSession, setHasSuccessfullySentCommentThisSession] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [commentInputFocused, setCommentInputFocused] = useState(false);
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.height : typeof window !== 'undefined' ? window.innerHeight : 0
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  /** Touch start position for carousel swipe on mobile */
  const carouselTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  /** Header fixed when keyboard is open OR user is in "Write a comment" input */
  const headerFixed = showBackToHome && (keyboardOpen || commentInputFocused);

  useEffect(() => {
    if (!showBackToHome || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const check = () => {
      setKeyboardOpen(vv.height < window.innerHeight * 0.8);
      setViewportOffsetTop(vv.offsetTop);
      setViewportHeight(vv.height);
    };
    check();
    vv.addEventListener('resize', check);
    vv.addEventListener('scroll', check, { passive: true });
    return () => {
      vv.removeEventListener('resize', check);
      vv.removeEventListener('scroll', check);
    };
  }, [showBackToHome]);

  /** Selalu cek akses agar Guest tidak lihat tombol Approve/Request Revision; tombol hanya untuk user login dengan role Owner/Admin (atau sesuai approval_access_configurations) */
  const { canShowApprovalButtons } = useProdApprovalAccess(true);
  const { user } = useAuth();
  const { data: profileData } = useUnifiedProfile();
  const isLoggedIn = !!user;
  const profileDisplayName = profileData?.fullName?.trim() ?? '';
  /** Mobile browser (bukan native): agar section write a comment dekat dengan pita navigasi, kurangi kedalaman scroll & tambah safe area bawah */
  const isMobileViewport = useIsMobile();
  const isMobileBrowser = isMobileViewport && !showBackToHome;

  const loadContent = useCallback(async () => {
    if (!token) return;
    const { data, error: rpcError } = await supabase.rpc('get_public_review_content_by_token', {
      token_param: token,
    });
    if (rpcError) {
      setError(t('publicReview.error.loadFailed', 'Failed to load content'));
      setContent(null);
      return;
    }
    if (data) {
      setContent(data as PublicReviewContent);
      setError(null);
    } else {
      setError(t('publicReview.error.invalidLink', 'Link is invalid or expired'));
      setContent(null);
    }
  }, [token, t]);

  const loadComments = useCallback(async () => {
    if (!token) return;
    const { data, error: rpcError } = await supabase.rpc('get_public_review_comments', {
      token_param: token,
    });
    if (rpcError) {
      devLog.warn('get_public_review_comments failed', rpcError);
      setComments([]);
      return;
    }
    setComments(Array.isArray(data) ? (data as PublicReviewComment[]) : []);
  }, [token]);

  /** Token-scoped only; data from brief_target_audiences + brief_captions via RPC (no cross-org leak) */
  const loadBriefExtended = useCallback(async () => {
    if (!token) return;
    const { data, error: rpcError } = await supabase.rpc('get_public_review_brief_extended_by_token', {
      token_param: token,
    });
    if (rpcError) {
      devLog.warn('get_public_review_brief_extended_by_token failed', rpcError);
      setBriefExtended(null);
      return;
    }
    if (data && typeof data === 'object' && 'target_audience' in data && 'caption' in data) {
      setBriefExtended({
        target_audience: String((data as PublicReviewBriefExtended).target_audience ?? ''),
        caption: String((data as PublicReviewBriefExtended).caption ?? ''),
      });
    } else {
      setBriefExtended(null);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setError(t('publicReview.error.noToken', 'No token'));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    const loadPromise = (async () => {
      await Promise.all([loadContent(), loadBriefExtended()]);
      if (cancelled) return;
      await loadComments();
    })();
    const { promise, cancel } = withTimeoutAndCancel(
      loadPromise,
      LOAD_TIMEOUT_MS,
      t('publicReview.error.timeout', 'Request timed out. Please try again.')
    );
    (async () => {
      setLoading(true);
      try {
        await promise;
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('publicReview.error.timeout', 'Request timed out. Please try again.'));
          setContent(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      cancel();
    };
  }, [token, loadContent, loadBriefExtended, loadComments, retryTrigger, t]);

  // Nama komentar: user login = dari profile aktif; guest = dari localStorage (atau nanti lewat popup)
  useEffect(() => {
    if (!token) return;
    if (isLoggedIn && profileDisplayName) {
      setCommenterDisplayName(profileDisplayName);
      return;
    }
    if (!isLoggedIn) {
      try {
        const raw = localStorage.getItem(REVIEW_COMMENTER_STORAGE_KEY + token);
        if (raw) {
          const parsed = JSON.parse(raw) as { displayName?: unknown };
          if (parsed && typeof parsed.displayName === 'string' && parsed.displayName.trim()) {
            setCommenterDisplayName(parsed.displayName.trim());
          }
        }
      } catch {
        // ignore invalid JSON
      }
    }
  }, [token, isLoggedIn, profileDisplayName]);

  // Reset video state when link changes
  useEffect(() => {
    setVideoUseIframe(false);
    setVideoPlaying(false);
  }, [content?.google_drive_link, content?.link_url]);

  // Set document title and og/twitter meta for link preview when content is loaded
  useEffect(() => {
    if (!content) return;
    const title = (content.title && content.title.trim()) ? content.title.trim() : 'Review konten';
    const description =
      [content.content_type_name, content.service_name, content.post_date ? format(new Date(content.post_date), 'dd MMM yyyy') : null]
        .filter(Boolean)
        .join(' · ') || 'Review dan beri masukan untuk konten ini.';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const imageUrl = origin ? `${origin}/favicon.svg` : '/favicon.svg';
    const pageUrl = origin && typeof window !== 'undefined' ? window.location.href : '';

    document.title = title;

    const setMeta = (attr: string, value: string, isProperty = true) => {
      const key = isProperty ? 'property' : 'name';
      let el = document.querySelector(`meta[${key}="${attr}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(key, attr);
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
    };

    setMeta('og:title', title);
    setMeta('og:description', description);
    setMeta('og:image', imageUrl);
    setMeta('og:url', pageUrl);
    setMeta('og:type', 'website');
    setMeta('twitter:card', 'summary_large_image', false);
    setMeta('twitter:title', title, false);
    setMeta('twitter:description', description, false);
    setMeta('twitter:image', imageUrl, false);

    return () => {
      document.title = 'Profitloop';
    };
  }, [content]);

  const handleSubmitComment = async () => {
    const text = commentText?.trim();
    if (!text || !token) {
      toast.error(t('publicReview.toast.writeFirst', 'Please write a comment first'));
      return;
    }
    // User login: pakai nama dari profile aktif (popup tidak ditampilkan). Guest: wajib isi nama lewat popup.
    const nameToUse = commenterDisplayName.trim() || (isLoggedIn ? profileDisplayName : '');
    if (!nameToUse) {
      if (isLoggedIn) {
        toast.info(t('publicReview.toast.waitProfile', 'Loading your profile. Please try again in a moment.'));
      } else {
        setShowCommenterPopup(true);
        setPopupNameInput('');
      }
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        token_param: token,
        comment_text: text,
        commenter_display_name: nameToUse,
      };
      const { error: rpcError } = await supabase.rpc('insert_public_review_comment', payload);
      if (rpcError) throw rpcError;
      if (nameToUse && nameToUse !== commenterDisplayName.trim()) setCommenterDisplayName(nameToUse);
      toast.success(t('publicReview.toast.success', 'Comment sent'));
      setCommentText('');
      await loadComments();
      setHasSuccessfullySentCommentThisSession(true);
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : null;
      toast.error(msg || t('publicReview.toast.error', 'Failed to send comment'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCommenterName = async () => {
    const name = popupNameInput?.trim();
    if (!name || !token) return;
    setCommenterDisplayName(name);
    try {
      localStorage.setItem(REVIEW_COMMENTER_STORAGE_KEY + token, JSON.stringify({ displayName: name }));
    } catch {
      // ignore quota etc.
    }
    setShowCommenterPopup(false);
    setPopupNameInput('');
    // If user had already typed a comment, submit it immediately
    const pendingText = commentText?.trim();
    if (pendingText) {
      setSubmitting(true);
      try {
        const payload: Record<string, unknown> = {
          token_param: token,
          comment_text: pendingText,
          commenter_display_name: name,
        };
        const { error: rpcError } = await supabase.rpc('insert_public_review_comment', payload);
        if (rpcError) throw rpcError;
        toast.success(t('publicReview.toast.success', 'Comment sent'));
        setCommentText('');
        await loadComments();
        setHasSuccessfullySentCommentThisSession(true);
      } catch (e) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : null;
        toast.error(msg || t('publicReview.toast.error', 'Failed to send comment'));
      } finally {
        setSubmitting(false);
      }
    }
  };

  const isOwnComment = (c: PublicReviewComment) =>
    !!commenterDisplayName.trim() && c.creator_display_name.trim().toLowerCase() === commenterDisplayName.trim().toLowerCase();

  /** Request Revision hanya boleh setelah user saat ini (nama di kolom comment) sudah mengirim minimal satu komentar */
  const hasCurrentUserCommented = comments.some(isOwnComment);

  const handleStartEdit = (c: PublicReviewComment) => {
    setEditingCommentId(c.id);
    setEditingText(c.comment_text ?? '');
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText('');
  };

  const handleSaveEdit = async () => {
    if (!token || !editingCommentId || !commenterDisplayName.trim()) return;
    const text = editingText?.trim();
    if (!text) return;
    setActionLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc('update_public_review_comment', {
        comment_id: editingCommentId,
        token_param: token,
        commenter_display_name: commenterDisplayName.trim(),
        new_comment_text: text,
      });
      if (rpcError) throw rpcError;
      toast.success(t('publicReview.toast.success', 'Comment sent'));
      setEditingCommentId(null);
      setEditingText('');
      await loadComments();
    } catch (e) {
      devLog.warn('Update comment error', e);
      toast.error(t('publicReview.toast.updateError', 'Failed to update comment'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteComment = async (c: PublicReviewComment) => {
    if (!token || !commenterDisplayName.trim()) return;
    if (!window.confirm(t('publicReview.comments.deleteConfirm', 'Delete this comment?'))) return;
    setActionLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc('delete_public_review_comment', {
        comment_id: c.id,
        token_param: token,
        commenter_display_name: commenterDisplayName.trim(),
      });
      if (rpcError) throw rpcError;
      toast.success(t('publicReview.toast.deleted', 'Comment deleted'));
      await loadComments();
    } catch (e) {
      devLog.warn('Delete comment error', e);
      toast.error(t('publicReview.toast.deleteError', 'Failed to delete comment'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = useCallback(async () => {
    if (!canShowApprovalButtons) return;
    const planId = content?.social_media_plan_id;
    if (!planId) {
      toast.error(t('publicReview.toast.planMissing', 'Plan ID is missing'));
      return;
    }
    setApprovalLoading(true);
    try {
      const approvedDate = new Date().toISOString();
      const { error } = await supabase
        .from('social_media_plans')
        .update({
          production_status: 'Approved',
          production_approved: true,
          production_approved_date: approvedDate,
        })
        .eq('id', planId);
      if (error) {
        devLog.error('Error updating production status for approval:', error);
        toast.error(t('publicReview.toast.approveFailed', 'Failed to approve production'));
        return;
      }
      toast.success(t('publicReview.toast.approveSuccess', 'Production approved successfully'));
    } catch (e) {
      devLog.error('Error in handleApprove:', e);
      toast.error(t('publicReview.toast.approveFailed', 'Failed to approve production'));
    } finally {
      setApprovalLoading(false);
    }
  }, [canShowApprovalButtons, content?.social_media_plan_id, t]);

  const handleRevision = useCallback(async () => {
    if (!canShowApprovalButtons) return;
    const displayName = commenterDisplayName.trim();
    const hasOwnComment =
      !!displayName && comments.some((c) => c.creator_display_name.trim().toLowerCase() === displayName.toLowerCase());
    if (!hasOwnComment) {
      toast.error(
        t(
          'publicReview.toast.revisionNeedComment',
          'Tambahkan minimal satu komentar (dengan nama Anda) sebelum request revision'
        )
      );
      return;
    }
    const planId = content?.social_media_plan_id;
    if (!planId || !token) {
      toast.error(t('publicReview.toast.planMissing', 'Plan ID is missing'));
      return;
    }
    setApprovalLoading(true);
    try {
      // Verifikasi dari server: pastikan user saat ini (nama di kolom comment) punya minimal satu komentar
      const { data: latestComments } = await supabase.rpc('get_public_review_comments', {
        token_param: token,
      });
      const commentList = Array.isArray(latestComments) ? (latestComments as { creator_display_name?: string }[]) : [];
      const hasCurrentUserComment = commentList.some(
        (c) => (c.creator_display_name ?? '').trim().toLowerCase() === displayName.toLowerCase()
      );
      if (!hasCurrentUserComment) {
        toast.error(
          t(
            'publicReview.toast.revisionNeedComment',
            'Tambahkan minimal satu komentar (dengan nama Anda) sebelum request revision'
          )
        );
        setApprovalLoading(false);
        return;
      }
      const { data: currentPlan, error: fetchError } = await supabase
        .from('social_media_plans')
        .select('production_revision_count, production_status')
        .eq('id', planId)
        .single();
      if (fetchError) {
        devLog.error('Error fetching current plan:', fetchError);
        toast.error(t('publicReview.toast.fetchFailed', 'Failed to fetch current data'));
        return;
      }
      if (!currentPlan) {
        toast.error(t('publicReview.toast.fetchFailed', 'Failed to fetch current data'));
        return;
      }
      const shouldIncrement = currentPlan.production_status !== 'Request Revision';
      const newProductionRevisionCount = shouldIncrement
        ? (currentPlan.production_revision_count || 0) + 1
        : (currentPlan.production_revision_count || 0);
      const updateData: Record<string, unknown> = {
        production_status: 'Request Revision',
        production_completion_date: null,
        production_approved: false,
        production_approved_date: null,
      };
      if (shouldIncrement) {
        updateData.production_revision_count = newProductionRevisionCount;
      }
      const { error, data: updatedRow } = await supabase
        .from('social_media_plans')
        .update(updateData)
        .eq('id', planId)
        .select('production_status')
        .maybeSingle();
      if (error) {
        devLog.error('Error updating production status for revision:', error);
        toast.error(t('publicReview.toast.revisionFailed', 'Failed to update production status'));
        return;
      }
      if (!updatedRow || updatedRow.production_status !== 'Request Revision') {
        devLog.error('Request Revision not persisted after update', {
          planId,
          actual: updatedRow?.production_status,
        });
        toast.error(
          t(
            'publicReview.toast.revisionNotSaved',
            'Request Revision was not saved. Refresh the page and try again, or contact an admin.'
          )
        );
        return;
      }
      // Uncomplete production step via RPC (without clearing link)
      const { data: planRow } = await supabase
        .from('social_media_plans')
        .select('organization_id')
        .eq('id', planId)
        .single();
      if (planRow?.organization_id) {
        const { error: rpcErr } = await revertStepCompletionFromDriveLinkRemovalWithRpc({
          organizationId: planRow.organization_id,
          socialMediaPlanId: planId,
          rejectedByEmployeeId: undefined,
        });
        if (rpcErr) {
          devLog.warn('revertStepCompletionFromDriveLinkRemovalWithRpc failed', {
            planId,
            message: rpcErr.message,
          });
        }
      }
      toast.success(t('publicReview.toast.revisionSuccess', 'Production status updated to Request Revision'));
      if (showBackToHome) {
        navigate('/tools/daily-task?view=jobdesc', { replace: true });
      }
    } catch (e) {
      devLog.error('Error in handleRevision:', e);
      toast.error(t('publicReview.toast.revisionFailed', 'Failed to update production status'));
    } finally {
      setApprovalLoading(false);
    }
  }, [canShowApprovalButtons, commenterDisplayName, comments, content?.social_media_plan_id, token, t, showBackToHome, navigate]);

  const link = content?.google_drive_link ?? content?.link_url ?? '';
  const embedUrl = getEmbedUrl(link);
  const directVideoUrl = isFileLink(link) ? getDirectVideoUrl(link) : '';

  useEffect(() => {
    setCarouselPreviewIndex(0);
  }, [content?.social_media_plan_id, content?.carousel_image_paths?.length]);

  const handleVideoPlay = useCallback(() => {
    videoRef.current?.play();
  }, []);

  if (loading) {
    return (
      <div
        className="min-h-screen bg-gray-50 flex items-center justify-center p-4"
        style={showBackToHome ? { minHeight: '100dvh', height: '100dvh' } : undefined}
      >
        <p className="text-gray-600">{t('publicReview.loading', 'Loading...')}</p>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div
        className="min-h-screen bg-gray-50 flex items-center justify-center p-4 flex flex-col gap-4"
        style={showBackToHome ? { minHeight: '100dvh', height: '100dvh' } : undefined}
      >
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error ?? t('publicReview.error.invalidLinkShort', 'Invalid link')}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => {
            setError(null);
            setRetryTrigger((prev) => prev + 1);
          }}
        >
          {t('publicReview.retry', 'Coba lagi')}
        </Button>
      </div>
    );
  }

  const formatDisplayDate = (date: string | null) => {
    if (!date) return '';
    return format(new Date(date), 'dd MMM yyyy');
  };

  /* GPU layer + containment agar scroll tidak lag (video/iframe tidak repaint tiap frame) */
  const scrollContainerStyle: React.CSSProperties = { WebkitOverflowScrolling: 'touch' };
  const videoLayerStyle: React.CSSProperties = {
    touchAction: 'pan-y',
    transform: 'translateZ(0)',
    contain: 'layout paint',
  };

  const contentTitle = content?.title || t('publicReview.content.noTitle', 'Untitled');

  return (
    <div
      className={cn(
        'min-h-screen h-screen max-h-screen bg-gray-50 flex flex-col min-w-0',
        showBackToHome ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden overscroll-behavior-y-contain',
      )}
      style={
        showBackToHome
          ? headerFixed
            ? {
                ...scrollContainerStyle,
                position: 'fixed',
                left: 0,
                right: 0,
                top: viewportOffsetTop,
                height: viewportHeight,
                minHeight: viewportHeight,
                maxHeight: viewportHeight,
              }
            : {
                ...scrollContainerStyle,
                minHeight: '100dvh',
                height: '100dvh',
                maxHeight: '100dvh',
                // Avoid pulling content under the fixed header when Android reports large top insets (emulator/WebView).
                // For small insets, keep legacy behavior to align the root without adding extra top space.
                marginTop: safeArea.top > 24 ? 0 : safeArea.top > 0 ? -safeArea.top : 0,
              }
          : scrollContainerStyle
      }
    >
      <Dialog open={showCommenterPopup} onOpenChange={setShowCommenterPopup}>
        <DialogContent
          overlayClassName="bg-black/50"
          className={cn(
            'max-w-[360px] w-[calc(100%-2rem)] border border-gray-200 bg-white shadow-xl rounded-xl p-6 text-left',
            'max-h-[min(85dvh,420px)] overflow-y-auto',
            'fixed left-[50%] -translate-x-1/2',
            'sm:top-[50%] sm:-translate-y-1/2',
            'max-sm:top-auto max-sm:bottom-4 max-sm:translate-y-0',
            '[&>button]:text-gray-600 [&>button]:hover:text-gray-900 [&>button]:hover:bg-gray-100',
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Let others know who you are
            </DialogTitle>
            <DialogDescription className="sr-only">
              Enter your name so it appears next to your comments. Saved per review link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <label htmlFor="commenter-name" className="text-sm font-medium text-gray-700">
                Your name
              </label>
              <Input
                id="commenter-name"
                type="text"
                placeholder="Your name"
                value={popupNameInput}
                onChange={(e) => setPopupNameInput(e.target.value)}
                className="w-full bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
              />
            </div>
            <Button
              onClick={handleSaveCommenterName}
              disabled={!popupNameInput.trim()}
              className="w-full bg-primary hover:bg-primary/90 text-white rounded-lg font-medium"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {showBackToHome && (
        <>
          <header
            className="z-30 flex items-center gap-2 px-3 pb-2 bg-card border-b border-border min-w-0 fixed left-0 right-0"
            style={{
              top: headerFixed ? viewportOffsetTop : 0,
              paddingTop: safeArea.top + 16,
              paddingBottom: 12,
              position: 'fixed' as const,
              left: 0,
              right: 0,
            }}
          >
            <button
            type="button"
            onClick={() => {
              const state = location.state as { from?: string } | null;
              const fromNotificationsModal = state?.from === 'notifications-modal';
              const fromJobDesc = state?.from === 'jobdesc';
              if (fromNotificationsModal) {
                navigate('/', { replace: true, state: { reopenNotifications: true } });
                return;
              }
              // On Android (showBackToHome) go to daily-task when from jobdesc; else home
              const target = showBackToHome ? '/tools/daily-task?view=jobdesc' : (fromJobDesc ? '/tools/daily-task?view=jobdesc' : '/');
              navigate(target, { replace: true });
            }}
            className="flex-shrink-0 p-1 -m-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted touch-manipulation"
            aria-label={showBackToHome || (location.state as { from?: string } | null)?.from === 'jobdesc' ? 'Back to Job Desc' : 'Back to home'}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground truncate min-w-0">
            {contentTitle}
          </h1>
        </header>
        </>
      )}
      <div
        className={cn(showBackToHome && 'flex-1 min-h-0 flex flex-col min-w-0')}
        style={!showBackToHome ? { flex: 1, minHeight: 0 } : undefined}
      >
      <div
        className={cn(
          'max-w-2xl w-full mx-auto sm:p-4 flex flex-col gap-2 min-w-0 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]',
          showBackToHome
            ? 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll'
            : 'flex-1 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
        )}
        style={
          showBackToHome
            ? {
                paddingTop: headerFixed ? viewportOffsetTop + safeArea.top + 68 : safeArea.top + 68,
                paddingBottom: '0.25rem',
              }
            : isMobileBrowser
              ? { paddingBottom: '0.5rem' }
              : { paddingBottom: `calc(5.5rem + ${safeArea.bottom}px)` }
        }
      >
        {/* Preview with header (title + metadata). Video: portrait (Reel) = 9/16, landscape = 16/9. Section responsive: min-height on video wrapper so content is not cut off. */}
        {(() => {
          const isPortrait = isPortraitContent(content?.content_type_name ?? null);
          const videoBoxClass = isPortrait
            ? 'aspect-[9/16] w-full max-w-full mx-auto min-w-0'
            : 'aspect-video w-full max-w-full mx-auto min-w-0';
          const isVideoFile = link && isFileLink(link);
          const videoWrapperMinHeight = isVideoFile && isPortrait ? { minHeight: 'min(56.25vw, 568px)' } : undefined;
          return (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col touch-pan-y min-w-0 flex-shrink-0">
              <div className="p-2 sm:p-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                {!showBackToHome && (
                  <div className="flex items-center gap-2 min-w-0">
                    <h1 className="font-semibold text-gray-900 truncate pr-2 text-sm sm:text-base min-w-0">
                      {contentTitle}
                    </h1>
                  </div>
                )}
                <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-x-4 sm:gap-y-2 text-xs text-gray-600', !showBackToHome && 'mt-1.5 sm:mt-2')}>
                  {content.service_name != null && content.service_name !== '' && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {content.service_name}
                    </span>
                  )}
                  {content.sub_service_name != null && content.sub_service_name !== '' && (
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {content.sub_service_name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {content.content_type_name || '—'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDisplayDate(content.post_date)}
                  </span>
                  {content.pic_production_name != null && content.pic_production_name.trim() !== '' && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      PIC Production: {content.pic_production_name}
                    </span>
                  )}
                </div>
              </div>
              <div
                className="flex-1 p-2 sm:p-4 flex items-center justify-center bg-white touch-pan-y min-w-0 min-h-0"
                style={videoWrapperMinHeight}
              >
                {(() => {
                  const isPostOrCarousel = content?.content_type_name === 'Post' || content?.content_type_name === 'Carousel';
                  const carouselPaths = content?.carousel_image_paths ?? [];
                  if (isPostOrCarousel && carouselPaths.length > 0) {
                    const urls = carouselPaths.map((p) => getCarouselImagePublicUrl(p));
                    const idx = Math.min(carouselPreviewIndex, urls.length - 1);
                    const SWIPE_THRESHOLD = 50;
                    const handleCarouselTouchStart = (e: React.TouchEvent) => {
                      carouselTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                    };
                    const handleCarouselTouchEnd = (e: React.TouchEvent) => {
                      const start = carouselTouchStartRef.current;
                      carouselTouchStartRef.current = null;
                      if (!start || urls.length <= 1) return;
                      const end = e.changedTouches[0];
                      const dx = end.clientX - start.x;
                      const dy = end.clientY - start.y;
                      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
                        if (dx > 0) {
                          setCarouselPreviewIndex((i) => Math.max(0, i - 1));
                        } else {
                          setCarouselPreviewIndex((i) => Math.min(urls.length - 1, i + 1));
                        }
                      }
                    };
                    const handleDownloadCurrent = async () => {
                      const url = urls[idx];
                      setCarouselDownloading(true);
                      try {
                        const res = await fetch(url, { mode: 'cors' });
                        if (!res.ok) throw new Error('Fetch failed');
                        const blob = await res.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = `carousel-${idx + 1}.jpg`;
                        a.click();
                        URL.revokeObjectURL(blobUrl);
                        toast.success(t('publicReview.preview.downloaded', 'Image downloaded'));
                      } catch {
                        window.open(url, '_blank');
                        toast.info(t('publicReview.preview.downloadFallback', 'Download failed, opened in new tab'));
                      } finally {
                        setCarouselDownloading(false);
                      }
                    };
                    return (
                      <div
                        className="w-full flex flex-col items-center gap-2"
                        {...(isMobileViewport
                          ? {
                              onTouchStart: handleCarouselTouchStart,
                              onTouchEnd: handleCarouselTouchEnd,
                              style: { touchAction: 'pan-y' } as React.CSSProperties,
                            }
                          : {})}
                      >
                        <div className="relative flex-1 min-h-0 w-full flex items-center justify-center">
                          <img
                            src={urls[idx]}
                            alt={`Carousel ${idx + 1}`}
                            className="max-w-full max-h-[min(70vh,568px)] object-contain rounded-lg select-none"
                            draggable={false}
                            style={isMobileViewport ? { touchAction: 'pan-y' } : undefined}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute top-1.5 right-1.5 h-8 w-8 rounded-full shadow-md border border-gray-200/80 bg-white/90 hover:bg-white"
                            disabled={carouselDownloading}
                            onClick={handleDownloadCurrent}
                            title={t('publicReview.preview.download', 'Download image')}
                            aria-label={t('publicReview.preview.download', 'Download image')}
                          >
                            {carouselDownloading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                        <div className="flex items-center justify-center gap-2 flex-shrink-0">
                          {isMobileViewport ? (
                            <div className="flex items-center gap-1.5" role="tablist" aria-label="Carousel slides">
                              {urls.map((_, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  role="tab"
                                  aria-selected={i === idx}
                                  aria-label={`Slide ${i + 1}`}
                                  onClick={() => setCarouselPreviewIndex(i)}
                                  className={cn(
                                    'rounded-full transition-all',
                                    i === idx
                                      ? 'h-2.5 w-2.5 bg-gray-800'
                                      : 'h-2 w-2 bg-gray-300 hover:bg-gray-400'
                                  )}
                                />
                              ))}
                            </div>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={idx <= 0}
                                onClick={() => setCarouselPreviewIndex((i) => Math.max(0, i - 1))}
                              >
                                Previous
                              </Button>
                              <span className="text-sm text-gray-600">
                                {idx + 1} / {urls.length}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={idx >= urls.length - 1}
                                onClick={() => setCarouselPreviewIndex((i) => Math.min(urls.length - 1, i + 1))}
                              >
                                Next
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }
                  if (isPostOrCarousel) {
                    return (
                      <div className="text-center text-gray-500 text-sm">
                        {t('publicReview.preview.noCarousel', 'No carousel images yet')}
                      </div>
                    );
                  }
                  if (!link) {
                    return <div className="text-center text-gray-500 text-sm">{t('publicReview.preview.noLink', 'No link')}</div>;
                  }
                  if (isFolderLink(link)) {
                    return (
                  <div className="w-full min-h-[200px] rounded-lg overflow-hidden touch-pan-y">
                    <GoogleDriveFolderCarousel folderUrl={link} />
                  </div>
                    );
                  }
                  if (isYouTubeLink(link)) {
                    return (
                <div className="text-center">
                    <p className="text-sm text-gray-700 mb-4">{t('publicReview.preview.youtubeUnavailable', 'YouTube preview is not available here.')}</p>
                    <Button variant="outline" size="sm" onClick={() => window.open(link, '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {t('publicReview.preview.openYouTube', 'Open in YouTube')}
                    </Button>
                  </div>
                    );
                  }
                  if (isFileLink(link) && embedUrl) {
                    return (
                  (() => {
                    const useIframe = videoUseIframe || !directVideoUrl;
                    const portraitVideoStyle = isPortrait
                      ? {
                          ...videoLayerStyle,
                          width: '100%',
                          aspectRatio: '9/16',
                          flexShrink: 0,
                          alignSelf: 'center',
                          maxHeight: 'min(568px, 80dvh)',
                        }
                      : { ...videoLayerStyle, flexShrink: 0 };
                    const isNative = showBackToHome;
                    const portraitAspectWrapper = isPortrait && isNative
                      ? { position: 'relative' as const, width: '100%', paddingBottom: '177.78%' }
                      : undefined;
                    if (useIframe) {
                      return (
                        <div className="w-full flex flex-col items-center flex-shrink-0">
                          {portraitAspectWrapper ? (
                            <div className="w-full rounded-lg overflow-hidden bg-black touch-pan-y shrink-0" style={portraitAspectWrapper}>
                              <iframe
                                src={embedUrl}
                                className="absolute inset-0 w-full h-full border-0 rounded-lg touch-pan-y"
                                style={{ touchAction: 'pan-y' }}
                                title="Preview"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div
                              className={`rounded-lg overflow-hidden bg-black touch-pan-y shrink-0 ${videoBoxClass}`}
                              style={portraitVideoStyle}
                            >
                              <iframe
                                src={embedUrl}
                                className="w-full h-full border-0 rounded-lg touch-pan-y"
                                style={{ touchAction: 'pan-y' }}
                                title="Preview"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                loading="lazy"
                              />
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div
                        className={portraitAspectWrapper ? 'w-full rounded-lg overflow-hidden bg-black touch-pan-y shrink-0' : `rounded-lg overflow-hidden bg-black touch-pan-y shrink-0 ${videoBoxClass} ${!videoPlaying ? 'cursor-pointer' : ''}`}
                        style={portraitAspectWrapper ?? portraitVideoStyle}
                        onClick={() => {
                          if (!videoPlaying) handleVideoPlay();
                        }}
                        role={!videoPlaying ? 'button' : undefined}
                        tabIndex={!videoPlaying ? 0 : undefined}
                        onKeyDown={!videoPlaying ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleVideoPlay();
                          }
                        } : undefined}
                        aria-label={!videoPlaying ? t('publicReview.preview.play', 'Play video') : undefined}
                      >
                        <video
                          ref={videoRef}
                          src={directVideoUrl}
                          className={cn(portraitAspectWrapper ? 'absolute inset-0 w-full h-full object-contain object-center touch-pan-y' : 'w-full h-full object-contain object-center touch-pan-y', !videoPlaying && 'pointer-events-none')}
                          style={{ touchAction: 'pan-y' }}
                          controls
                          playsInline
                          onError={() => setVideoUseIframe(true)}
                          onPlay={() => setVideoPlaying(true)}
                          onPause={() => setVideoPlaying(false)}
                          onEnded={() => setVideoPlaying(false)}
                        />
                      </div>
                    );
                  })()
                    );
                  }
                  return (
                  <div className="text-center">
                    <LinkIcon className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-700 mb-4">{t('publicReview.preview.unavailable', 'Preview not available')}</p>
                    <Button variant="outline" size="sm" onClick={() => window.open(link, '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {t('publicReview.preview.openLink', 'Open link')}
                    </Button>
                  </div>
                  );
                })()}
              </div>
            </div>
          );
        })()}

        {/* Concept - hanya tampil jika ada isi (data dari RPC yang sama, tanpa request tambahan) */}
        {briefExtended?.target_audience?.trim() ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col flex-shrink-0 overflow-hidden min-w-0">
            <div className="p-2 sm:p-3 border-b border-blue-200/80 bg-blue-50 flex-shrink-0 border-l-4 border-l-blue-500">
              <h4 className="font-medium text-sm text-blue-900">{t('briefDialog.sectionTargetAudience', 'Concept')}</h4>
            </div>
            <div className="h-32 sm:h-40 overflow-y-auto p-2 sm:p-3 text-sm text-gray-700 whitespace-pre-wrap break-words">
              {briefExtended.target_audience}
            </div>
          </div>
        ) : null}

        {/* Caption - hanya tampil jika ada isi */}
        {briefExtended?.caption?.trim() ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col flex-shrink-0 overflow-hidden min-w-0">
            <div className="p-2 sm:p-3 border-b border-emerald-200/80 bg-emerald-50 flex-shrink-0 border-l-4 border-l-emerald-500">
              <h4 className="font-medium text-sm text-emerald-900">{t('briefDialog.sectionCaption', 'Caption')}</h4>
            </div>
            <div className="overflow-y-auto p-2 sm:p-3 text-sm text-gray-700 whitespace-pre-wrap break-words min-h-[72px] sm:min-h-[80px]">
              {briefExtended.caption}
            </div>
          </div>
        ) : null}

        {/* Comments - selalu ditampilkan (border sama seperti Concept) */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col flex-shrink-0 min-h-[320px] min-w-0 overflow-visible">
          <div className="p-2 sm:p-3 border-b border-blue-200/80 bg-blue-50 flex-shrink-0 flex items-center gap-2 border-l-4 border-l-blue-500">
            <MessageSquare className="h-4 w-4 shrink-0 text-blue-600" />
            <h4 className="font-medium text-sm text-blue-900 truncate">{t('publicReview.comments.title', 'Comments')}</h4>
          </div>
          <div className="flex-1 min-h-[120px] overflow-auto overflow-x-hidden p-2 sm:p-3 space-y-2">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500">{t('publicReview.comments.empty', 'No comments yet. Be the first.')}</p>
            ) : (
              comments.map((c) => {
                const own = isOwnComment(c);
                const isEditing = editingCommentId === c.id;
                const accent = getCommentAccent(c.id);
                return (
                  <div key={c.id} className="w-full">
                    <div className={cn('relative rounded-lg border border-gray-200/80 px-2 py-2 sm:px-3 w-full max-w-full border-l-4 min-w-0', accent.border, accent.bg)}>
                      {/* Nama & tanggal kiri-atas; ikon edit & delete menempel di sudut kanan-atas */}
                      <div className="flex items-start text-xs text-gray-600 mb-1 pr-0">
                        <div className="min-w-0 flex-1 pr-16">
                          <span className="font-medium text-gray-800 truncate block">{c.creator_display_name}</span>
                          <span className="text-gray-500 whitespace-nowrap">{c.created_at ? format(new Date(c.created_at), 'dd MMM yyyy, HH:mm') : ''}</span>
                        </div>
                        {own && !isEditing && (
                          <div className="absolute top-0 right-0 flex items-center gap-0 flex-shrink-0 mt-0.5 mr-0.5 sm:mt-1 sm:mr-1">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(c)}
                              disabled={actionLoading}
                              className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-200 touch-manipulation"
                              aria-label={t('publicReview.comments.edit', 'Edit')}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(c)}
                              disabled={actionLoading}
                              className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 touch-manipulation"
                              aria-label={t('publicReview.comments.delete', 'Delete')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="min-h-[80px] text-sm resize-none"
                            disabled={actionLoading}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={handleCancelEdit} disabled={actionLoading}>
                              {t('publicReview.comments.cancel', 'Cancel')}
                            </Button>
                            <Button size="sm" onClick={handleSaveEdit} disabled={actionLoading || !editingText.trim()}>
                              {t('publicReview.comments.saveEdit', 'Save')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{c.comment_text ?? ''}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {!showBackToHome && (
            <div
              className="p-3 sm:p-4 border-t border-gray-200 flex-shrink-0 space-y-3 bg-white"
              style={isMobileBrowser && safeArea.bottom > 0 ? { paddingBottom: `max(0.75rem, ${safeArea.bottom}px)` } : undefined}
            >
              <div className="relative">
                <Textarea
                  ref={commentTextareaRef}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t('publicReview.comments.placeholder', 'Write a comment...')}
                  className="min-h-[80px] sm:min-h-[88px] text-sm resize-none w-full min-w-0 pr-11 pb-2 border border-input bg-background"
                  disabled={submitting}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || submitting}
                  title={submitting ? t('publicReview.comments.sending', 'Sending...') : t('publicReview.comments.add', 'Add Comment')}
                  aria-label={submitting ? t('publicReview.comments.sending', 'Sending...') : t('publicReview.comments.add', 'Add Comment')}
                  className="absolute right-2 bottom-2 h-9 w-9 rounded-lg shrink-0 touch-manipulation"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {canShowApprovalButtons && (
                <div className="w-full flex flex-nowrap items-center gap-3 pt-2 border-t border-gray-100 flex-shrink-0 pb-4">
                  <Button
                    onClick={handleApprove}
                    disabled={approvalLoading || !!commentText.trim() || hasSuccessfullySentCommentThisSession}
                    className="flex-1 min-w-0 h-9 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium px-3 gap-2 min-h-[44px] touch-manipulation"
                  >
                    <Check className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t('publicReview.approveContent', 'Approve Content')}</span>
                  </Button>
                  <Button
                    onClick={handleRevision}
                    disabled={!hasSuccessfullySentCommentThisSession || approvalLoading}
                    variant="outline"
                    title={!hasSuccessfullySentCommentThisSession ? t('publicReview.toast.revisionNeedComment', 'Tambahkan minimal satu komentar (dengan nama Anda) sebelum request revision') : undefined}
                    className="flex-1 min-w-0 h-9 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 rounded-lg font-medium px-3 gap-2 min-h-[44px] touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t('publicReview.requestRevision', 'Request Revision')}</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      {showBackToHome && (
        <div
          className="flex-shrink-0 w-full max-w-2xl mx-auto bg-gray-50 border-t border-gray-200 px-3 sm:p-4 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]"
          style={{
            paddingBottom: keyboardOpen
              ? '0.5rem'
              : safeArea.bottom > 0 ? `${safeArea.bottom}px` : '0.125rem',
          }}
        >
          <div className="space-y-3 pt-3">
            <div className="relative">
              <Textarea
                ref={commentTextareaRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onFocus={() => {
                  setCommentInputFocused(true);
                  setKeyboardOpen(true);
                  requestAnimationFrame(() => {
                    commentTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  });
                }}
                onBlur={() => {
                  setCommentInputFocused(false);
                  window.setTimeout(() => {
                    if (typeof window !== 'undefined' && window.visualViewport && window.visualViewport.height >= window.innerHeight * 0.8) {
                      setKeyboardOpen(false);
                    }
                  }, 300);
                }}
                placeholder={t('publicReview.comments.placeholder', 'Write a comment...')}
                className="min-h-[80px] sm:min-h-[88px] text-sm resize-none w-full min-w-0 pr-11 pb-2 border border-input bg-background rounded-lg"
                disabled={submitting}
              />
              <Button
                type="button"
                size="icon"
                onClick={handleSubmitComment}
                disabled={!commentText.trim() || submitting}
                title={submitting ? t('publicReview.comments.sending', 'Sending...') : t('publicReview.comments.add', 'Add Comment')}
                aria-label={submitting ? t('publicReview.comments.sending', 'Sending...') : t('publicReview.comments.add', 'Add Comment')}
                className="absolute right-2 bottom-2 h-9 w-9 rounded-lg shrink-0 touch-manipulation"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {canShowApprovalButtons && !keyboardOpen && (
              <div className="w-full flex flex-nowrap items-center gap-3 pt-2 border-t border-gray-200 flex-shrink-0 pb-2">
                <Button
                  onClick={handleApprove}
                  disabled={approvalLoading || !!commentText.trim() || hasSuccessfullySentCommentThisSession}
                  className="flex-1 min-w-0 h-9 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium px-3 gap-2 min-h-[44px] touch-manipulation"
                >
                  <Check className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t('publicReview.approveContent', 'Approve Content')}</span>
                </Button>
                <Button
                  onClick={handleRevision}
                  disabled={!hasSuccessfullySentCommentThisSession || approvalLoading}
                  variant="outline"
                  title={!hasSuccessfullySentCommentThisSession ? t('publicReview.toast.revisionNeedComment', 'Tambahkan minimal satu komentar (dengan nama Anda) sebelum request revision') : undefined}
                  className="flex-1 min-w-0 h-9 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 rounded-lg font-medium px-3 gap-2 min-h-[44px] touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t('publicReview.requestRevision', 'Request Revision')}</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
      </div>
    </div>
  );
};

export default PublicContentReviewPage;
