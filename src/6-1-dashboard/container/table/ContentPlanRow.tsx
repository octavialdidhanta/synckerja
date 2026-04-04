import React, { memo, useState, useRef, useEffect } from 'react';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { Button } from '@/shared/components/ui/button';
import { Lock, User } from 'lucide-react';
import { ContentPlan, ContentType, Service, SubService, ContentPillar } from '../../types/social-media';
import { BriefPreview } from './BriefPreview';
import { RevisionCounter } from './RevisionCounter';
import { PostDateCell } from './cells/PostDateCell';
import { PICCell } from './cells/PICCell';
import { GoogleDriveLinkCell, PostLinkCell } from './cells/LinkCells';
import { validateRequiredFields } from './cells/ValidationHelper';
import GoogleDriveLinkDialog from '../../modal/GoogleDriveLinkDialog';
import SocialMediaLinksDialog from '../../modal/SocialMediaLinksDialog';
import type { DigitalMarketingEmployee } from '../../hook/useDigitalMarketingEmployees';
import type { CreativeEmployee } from '../../hook/useCreativeEmployees';
import { useToast } from '@/shared/components/ui/use-toast';
import { useSocialMediaLinks } from '@/6-1-dashboard/hook/useSocialMediaLinks';
import type { User as AuthUser } from '@supabase/supabase-js';
import { getAuthUserCoalesced, supabase } from '@/shared/lib/supabaseClient';
import { devLog, logger } from '@/shared/lib/logger';
import { cn } from '@/shared/lib/utils';
import { CreateTaskDialog } from '@/8-2-DailyTask/section/CreateTaskDialog';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Simple in-memory cache for approval/revision checks to avoid repeated DB queries
const approvalCheckCache = new Map<string, { result: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

interface ApprovalAccess {
  approved: boolean;
  prodApproved: boolean;
  loading: boolean;
}

interface ContentPlanRowProps {
  plan: ContentPlan;
  contentTypes: ContentType[];
  services: Service[];
  subServices: SubService[];
  contentPillars: ContentPillar[];
  selectedItems: string[];
  onSelectItem: (id: string, checked: boolean) => void;
  onFieldChange: (id: string, field: string, value: any) => void | Promise<void>;
  onOpenBriefDialog: (id: string, brief: string | null) => void;
  onOpenTitleDialog: (id: string, title: string | null, approved?: boolean) => void;
  onStatusChange: (id: string, value: string) => void;
  onProductionStatusChange: (id: string, value: string | null) => void;
  onStatusContentChange: (id: string, value: string) => void;
  onResetRevision: (id: string, field: 'revision_count' | 'production_revision_count') => void;
  onOpenLink: (url: string) => void;
  getFilteredSubServices: (serviceId: string | null) => SubService[];
  formatDateTime: (date: string | Date) => string;
  formatDateOnly: (date: string | Date) => string;
  approvalAccess?: ApprovalAccess; // Batch-checked approval access from parent
  digitalEmployees?: DigitalMarketingEmployee[];
  creativeEmployees?: CreativeEmployee[];
  currentUserRole?: string | null;
  carouselImageCount?: number;
  onCarouselChange?: () => void;
  onCarouselFirstUploadSuccess?: (planId: string) => void;
  onCarouselAllRemoved?: (planId: string) => void;
  onProductionResubmitForReview?: (planId: string) => void | Promise<void>;
}
export const ContentPlanRow = memo<ContentPlanRowProps>(({
  plan,
  contentTypes,
  services,
  subServices,
  contentPillars,
  selectedItems,
  onSelectItem,
  onFieldChange,
  onOpenBriefDialog,
  onOpenTitleDialog,
  onStatusChange,
  onProductionStatusChange,
  onStatusContentChange,
  onResetRevision,
  onOpenLink,
  getFilteredSubServices,
  formatDateTime,
  formatDateOnly,
  approvalAccess,
  digitalEmployees = [],
  creativeEmployees = [],
  currentUserRole = null,
  carouselImageCount = 0,
  onCarouselChange,
  onCarouselFirstUploadSuccess,
  onCarouselAllRemoved,
  onProductionResubmitForReview
}) => {
  const [isGoogleDriveDialogOpen, setIsGoogleDriveDialogOpen] = useState(false);
  const [isSocialLinksDialogOpen, setIsSocialLinksDialogOpen] = useState(false);
  const [showApprovalOptions, setShowApprovalOptions] = useState({
    status: true,
    production_status: true
  });
  // Fallback Create Task for Branding Plan task existence
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [createPrefillTitle, setCreatePrefillTitle] = useState('');
  const [createTriggeredOnce, setCreateTriggeredOnce] = useState(false);
  // Initialize to false to prevent refresh icons showing before config check completes
  const [revisionConfigActive, setRevisionConfigActive] = useState(false);
  const [productionRevisionConfigActive, setProductionRevisionConfigActive] = useState(false);
  const [canApproveProduction, setCanApproveProduction] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const {
    toast
  } = useToast();
  const {
    links
  } = useSocialMediaLinks(plan.id);

  // Helpers for Branding Plan auto-create when approved toggled ON
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const getServiceName = () => {
    const name = (plan as any)?.service?.name || services.find(s => s.id === plan.service_id)?.name || '';
    return name;
  };
  const maybeOpenBrandingPlanCreate = async () => {
    if (createTriggeredOnce) return;
    try {
      const serviceName = getServiceName();
      if (!serviceName || !plan.post_date || !(plan as any).organization_id) {
        devLog.debug('maybeOpenBrandingPlanCreate: missing plan data (service, post_date or organization_id)');
        return;
      }
      const d = new Date(plan.post_date);
      if (isNaN(d.getTime())) return;

      // IMPORTANT: Jangan bergantung pada due_date karena bisa NULL.
      // Ambil task berdasarkan organization saja, dan batasi via judul 'branding plan' untuk efisiensi,
      // lalu filter di klien berdasarkan service dan bulan Indonesia.
      const { data: tasks, error } = await supabase
        .from('daily_tasks')
        .select('id, title')
        .eq('organization_id', (plan as any).organization_id)
        .ilike('title', '%branding plan%')
        .order('created_at', { ascending: false });

      if (error) {
        devLog.error('Error fetching monthly daily_tasks:', error);
        return;
      }

      const monthTextID = format(d, 'MMMM yyyy', { locale: idLocale }).toLowerCase();
      const hasBrandingTask = (tasks || []).some(t => {
        const title = normalize(t.title || '');
        return title.includes('branding plan') && title.includes(normalize(serviceName)) && title.includes(monthTextID);
      });

      if (!hasBrandingTask) {
        setCreatePrefillTitle(`${serviceName} - Branding Plan ${format(d, 'MMMM yyyy', { locale: idLocale })}`);
        setIsCreateTaskOpen(true);
        setCreateTriggeredOnce(true);
      }
    } catch (e) {
      devLog.error('maybeOpenBrandingPlanCreate error:', e);
    }
  };

  // Recheck existence when CreateTaskDialog closed; if masih belum ada, rollback approved
  const recheckOrRollbackAfterCreateClose = async () => {
    try {
      const serviceName = getServiceName();
      if (!serviceName || !plan.post_date || !(plan as any).organization_id) {
        devLog.debug('recheckOrRollbackAfterCreateClose: missing plan data (service, post_date or organization_id)');
        return;
      }
      const d = new Date(plan.post_date);
      if (isNaN(d.getTime())) return;

      const { data: tasks, error } = await supabase
        .from('daily_tasks')
        .select('id, title')
        .eq('organization_id', (plan as any).organization_id)
        .ilike('title', '%branding plan%')
        .order('created_at', { ascending: false });

      if (error) {
        devLog.error('Error rechecking daily_tasks:', error);
        return;
      }

      const monthTextID = format(d, 'MMMM yyyy', { locale: idLocale }).toLowerCase();
      const exists = (tasks || []).some(t => {
        const title = normalize(t.title || '');
        return title.includes('branding plan') && title.includes(normalize(serviceName)) && title.includes(monthTextID);
      });

      if (!exists) {
        // Rollback approved, completion_date, and status to Need Review
        setApprovedInstant(false); // visual rollback instantly
        onFieldChange(plan.id, 'approved', false);
        onFieldChange(plan.id, 'completion_date', null);
        if (plan.status === 'Approved') {
          onStatusChange(plan.id, 'Need Review');
        }
        // Allow triggering again next time
        setCreateTriggeredOnce(false);
      }
    } catch (e) {
      devLog.error('recheckOrRollbackAfterCreateClose error:', e);
    }
  };
  // Use batch-checked approval access from parent if available, otherwise fallback to individual checks
  React.useEffect(() => {
    const checkApprovalVisibility = async () => {
      try {
        let statusAccess: boolean;
        let prodApprovalAccess: boolean;

        if (approvalAccess && !approvalAccess.loading) {
          // Use batch-checked approval access from parent (optimized)
          statusAccess = approvalAccess.approved;
          prodApprovalAccess = approvalAccess.prodApproved;
        } else {
          // Fallback to individual checks if approvalAccess not provided or still loading
          statusAccess = await checkAnyUserHasApprovalAccess('approved');
          prodApprovalAccess = await checkAnyUserHasApprovalAccess('prod_approved');
        }

        setShowApprovalOptions({
          status: statusAccess,
          production_status: prodApprovalAccess
        });
        setCanApproveProduction(prodApprovalAccess);

        const authUser = await getAuthUserCoalesced();
        const revisionAccess = await checkRevisionAccess(authUser);
        setRevisionConfigActive(revisionAccess);

        const productionRevisionAccess = await checkProductionRevisionAccess(authUser);
        setProductionRevisionConfigActive(productionRevisionAccess);
        
        setConfigLoaded(true);
      } catch (error) {
        devLog.error('Error checking approval visibility:', error);
        // On error, keep refresh icons hidden
        setRevisionConfigActive(false);
        setProductionRevisionConfigActive(false);
        setConfigLoaded(true);
      }
    };
    checkApprovalVisibility();
  }, [approvalAccess]);

  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';

  // Fast approval access using batched result from parent (no awaits for instant UX)
  const checkApprovalAccess = (columnType: string): boolean => {
    if (columnType === 'approved') return !!approvalAccess?.approved;
    if (columnType === 'prod_approved') return !!approvalAccess?.prodApproved;
    return false;
  };

  // Function to check if CURRENT user has approval access for a column type
  const checkAnyUserHasApprovalAccess = async (columnType: string) => {
    // This function should check if the CURRENT user has access, not if ANY user has access
    return await checkApprovalAccess(columnType);
  };

  // Function to check if current user has revision access based on roles and exceptions (with caching)
  const checkRevisionAccess = async (user: AuthUser | null) => {
    try {
      if (!user) return false;

      // Get user's active organization
      const {
        data: profile,
        error: profileError
      } = await supabase.from('profiles').select('active_organization_id').eq('user_id', user.id).single();
      if (profileError || !profile?.active_organization_id) {
        devLog.error('Error fetching user profile:', profileError);
        return false;
      }

      // Check cache first
      const cacheKey = `revision_${user.id}_${profile.active_organization_id}`;
      const cached = approvalCheckCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        // Cache hit - return without logging
        return cached.result;
      }

      // Get user's role in the organization
      const {
        data: userRole,
        error: roleError
      } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('organization_id', profile.active_organization_id).single();
      if (roleError || !userRole) {
        devLog.error('Error fetching user role:', roleError);
        return false;
      }

      // Get user's employee record to check exceptions
      const {
        data: employee,
        error: employeeError
      } = await supabase.from('employees').select('id').eq('user_id', user.id).eq('organization_id', profile.active_organization_id).single();
      if (employeeError || !employee) {
        devLog.error('Error fetching employee:', employeeError);
        return false;
      }

      // First check if ANY revision configuration exists (regardless of is_active)
      const {
        data: anyConfig,
        error: anyConfigError
      } = await supabase.from('approval_access_configurations').select('is_active').eq('organization_id', profile.active_organization_id).eq('column_type', 'revision').maybeSingle();

      // If any configuration exists but is inactive, hide refresh icon
      if (anyConfig && !anyConfig.is_active) {
        const result = false;
        approvalCheckCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      // Get revision configuration for the organization (only active ones)
      const {
        data: config,
        error: configError
      } = await supabase.from('approval_access_configurations').select('*').eq('organization_id', profile.active_organization_id).eq('column_type', 'revision').eq('is_active', true).maybeSingle();
      if (configError || !config) {
        const result = userRole.role === 'owner' || userRole.role === 'admin';
        approvalCheckCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      // Check if user's role is in the allowed roles
      const hasRoleAccess = config.allowed_roles?.includes(userRole.role);

      // Check if user is in the exceptions list
      const isException = config.exceptions?.includes(employee.id);
      const result = hasRoleAccess || isException;
      
      // Cache the result
      approvalCheckCache.set(cacheKey, { result, timestamp: Date.now() });
      
      return result;
    } catch (error) {
      devLog.error('Error checking revision access:', error);
      return false;
    }
  };

  // Function to check if current user has production revision access based on roles and exceptions (with caching)
  const checkProductionRevisionAccess = async (user: AuthUser | null) => {
    try {
      if (!user) return false;

      // Get user's active organization
      const {
        data: profile,
        error: profileError
      } = await supabase.from('profiles').select('active_organization_id').eq('user_id', user.id).single();
      if (profileError || !profile?.active_organization_id) {
        devLog.error('Error fetching user profile:', profileError);
        return false;
      }

      // Check cache first
      const cacheKey = `production_revision_${user.id}_${profile.active_organization_id}`;
      const cached = approvalCheckCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        // Cache hit - return without logging
        return cached.result;
      }

      // Get user's role in the organization
      const {
        data: userRole,
        error: roleError
      } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('organization_id', profile.active_organization_id).single();
      if (roleError || !userRole) {
        devLog.error('Error fetching user role:', roleError);
        return false;
      }

      // Get user's employee record to check exceptions
      const {
        data: employee,
        error: employeeError
      } = await supabase.from('employees').select('id').eq('user_id', user.id).eq('organization_id', profile.active_organization_id).single();
      if (employeeError || !employee) {
        devLog.error('Error fetching employee:', employeeError);
        return false;
      }

      // First check if ANY production revision configuration exists (regardless of is_active)
      const {
        data: anyConfig,
        error: anyConfigError
      } = await supabase.from('approval_access_configurations').select('is_active').eq('organization_id', profile.active_organization_id).eq('column_type', 'production_revision').maybeSingle();

      // If any configuration exists but is inactive, hide refresh icon
      if (anyConfig && !anyConfig.is_active) {
        const result = false;
        approvalCheckCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      // Get production revision configuration for the organization (only active ones)
      const {
        data: config,
        error: configError
      } = await supabase.from('approval_access_configurations').select('*').eq('organization_id', profile.active_organization_id).eq('column_type', 'production_revision').eq('is_active', true).maybeSingle();
      if (configError || !config) {
        const result = userRole.role === 'owner' || userRole.role === 'admin';
        approvalCheckCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      // Check if user's role is in the allowed roles
      const hasRoleAccess = config.allowed_roles?.includes(userRole.role);

      // Check if user is in the exceptions list
      const isException = config.exceptions?.includes(employee.id);
      const result = hasRoleAccess || isException;
      
      // Cache the result
      approvalCheckCache.set(cacheKey, { result, timestamp: Date.now() });
      
      return result;
    } catch (error) {
      devLog.error('Error checking production revision access:', error);
      return false;
    }
  };

  // Remove job position filtering for PIC (column 3) - use all digital employees
  const picEmployees = digitalEmployees;

  // Find selected PIC employee name
  const selectedPIC = digitalEmployees.find(emp => emp.id === plan.pic_id);

  // For PIC Production, use the data from the database relation first, then fallback to digitalEmployees
  const selectedProductionPIC = plan.pic_production?.full_name ? {
    full_name: plan.pic_production.full_name,
    id: plan.pic_production.id
  } : digitalEmployees.find(emp => emp.id === plan.pic_production_id);
  
  // Only log if there's a mismatch (pic_production_id exists but employee not found)
  if (plan.pic_production_id && !selectedProductionPIC) {
    logger.rateLimited(`pic-production-missing:${plan.id}`, 5000, () => {
      devLog.debug('⚠️ PIC Production employee not found:', {
        plan_id: plan.id,
        pic_production_id: plan.pic_production_id,
        digitalEmployeesCount: digitalEmployees?.length || 0
      });
    });
  }

  // Get content type name for display
  const contentTypeName = contentTypes.find(type => type.id === plan.content_type_id)?.name || '';
  

  // POINT 4: Content fields are no longer locked when approved
  // const isContentLocked = plan.approved === true; // REMOVED: No more locking

  // POINT 3: Production fields are no longer locked when production approved
  // const isProductionLocked = plan.production_approved === true; // REMOVED: No more production locking

  // Track the last post_date values to detect changes
  const calculateOnTimeStatus = (actualPostDate: string | null, postDate: string) => {
    if (!actualPostDate || !postDate) return '';
    
    try {
      const actual = new Date(actualPostDate);
      const planned = new Date(postDate);
      
      // Check if dates are valid
      if (isNaN(actual.getTime()) || isNaN(planned.getTime())) {
        return '';
      }
      
      // Calculate difference in days
      const diffTime = actual.getTime() - planned.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) {
        return 'Ontime';
      } else {
        return `Late ${diffDays} Day${diffDays > 1 ? 's' : ''}`;
      }
    } catch (error) {
      devLog.error('Error calculating on-time status:', error);
      return '';
    }
  };

  // Calculate on-time status for display
  const displayOnTimeStatus = () => {
    if (!plan.post_date) {
      return '';
    }

    // Prefer using stored on_time_status from database when available
    if (plan.on_time_status && plan.on_time_status.trim().length > 0) {
      return plan.on_time_status;
    }

    // Fallback: compute using actual_post_date value
    return calculateOnTimeStatus(plan.actual_post_date, plan.post_date);
  };

  // Calculate actual post date for display
  const displayActualPostDate = () => {
    // If there are links, show current date
    return plan.actual_post_date ? formatDateOnly(plan.actual_post_date) : '-';
  };
  const handleCheckboxChange = (checked: boolean) => {
    onSelectItem(plan.id, checked);
  };

  // Check if PIC field should be locked (auto-populated from Add Content or Post Link)
  const isPICLocked = plan.pic_id !== null && plan.pic_id !== undefined && plan.pic_id !== '';

  // Check if PIC Production field should be locked (auto-populated from Google Drive Link)
  const isPICProductionLocked = plan.pic_production_id !== null && plan.pic_production_id !== undefined && plan.pic_production_id !== '';

  // Check if Google Drive Link should be disabled (when Approved is false)
  const isGoogleDriveLinkDisabled = !plan.approved;

  // Check if Post Link should be disabled (when Production Approved is false)
  const isPostLinkDisabled = !plan.production_approved;

  // UPDATED: Handle Google Drive Link change with auto-save and production status logic
  const handleGoogleDriveLinkChange = (value: string) => {
    // Normalize: Convert empty string to null for consistency
    const normalizedValue = value && value.trim().length > 0 ? value : null;
    
    if (normalizedValue) {
      // Single update: handleFieldChange(google_drive_link) sends link + Need Review + completion_date (+ PIC).
      // Do not call onProductionStatusChange here — that batches only production_status and can race / leave the dropdown on "No Status".
      onFieldChange(plan.id, 'google_drive_link', normalizedValue);
    } else {
      // If link is being cleared, also clear PIC Production and set production status to null
      // Standardize: Save as null instead of empty string for consistency
      onFieldChange(plan.id, 'google_drive_link', null);
      onFieldChange(plan.id, 'pic_production_id', null);
      onProductionStatusChange(plan.id, null); // Also standardize to null
    }
  };

  // POINT 2: Handle Approved change - check approval access configuration
  // Local visual state to make unapprove instant without waiting server
  const [approvedInstant, setApprovedInstant] = useState<boolean | null>(null);
  // Sinkronkan kembali ke nilai dari server setelah update datang
  useEffect(() => {
    // Setelah plan.approved berubah (hasil server/realtime), serahkan kontrol ke data server
    setApprovedInstant(null);
  }, [plan.approved]);

  const handleApprovedChange = async (checked: boolean) => {
    // Check if user has approval access based on pre-fetched configuration
    const hasApprovalAccess = checkApprovalAccess('approved');
    if (!hasApprovalAccess) {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "You don't have permission to approve this content"
      });
      return;
    }
    if (checked) {
      // Selalu biarkan toggle tetap OFF; parent akan membuka modal Select Daily Task via requestApproval
      // Validasi field wajib
      const missingFields = validateRequiredFields(plan);
      if (missingFields.length > 0) {
        toast({
          variant: "destructive",
          title: "Cannot approve content",
          description: `Please fill in the following required fields: ${missingFields.join(', ')}`
        });
        return;
      }
      // Jangan ubah visual ON, cukup minta parent update field 'approved' → parent akan intercept dan buka modal
      onFieldChange(plan.id, 'approved', true);
      return;
    } else {
      // Make unapprove visual instant
      setApprovedInstant(false);
      // Urutan: approved=false dulu agar SocialMediaDashboardPage bisa membuka pendingApprovalPlansRef
      // sebelum completion_date / status (mencegah update ter-swallow saat flag pending masih nyangkut).
      onFieldChange(plan.id, 'approved', false);
      onFieldChange(plan.id, 'completion_date', null);
      if (plan.status === 'Approved') {
        onStatusChange(plan.id, 'Need Review');
      }
      setCreateTriggeredOnce(false);
    }
  };

  // POINT 3: Handle Production Approved change - OPTIMIZED: Batch updates and prevent double-clicks
  const [isUpdatingProductionApproved, setIsUpdatingProductionApproved] = useState(false);
  
  const handleProductionApprovedChange = async (checked: boolean) => {
    // Prevent double-clicks and concurrent updates
    if (isUpdatingProductionApproved) {
      return;
    }

    // Quick access check using cached value first (non-blocking for better UX)
    // Use canApproveProduction which is already checked on mount
    if (!canApproveProduction) {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "You don't have permission to approve production"
      });
      return;
    }

    setIsUpdatingProductionApproved(true);
    
    try {
      // Double-check access (async but should be fast due to caching)
      const hasApprovalAccess = await checkApprovalAccess('prod_approved');
      if (!hasApprovalAccess) {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You don't have permission to approve production"
        });
        setIsUpdatingProductionApproved(false);
        return;
      }

      // Validate: Cannot set production_approved to true if google_drive_link is NULL or EMPTY
      // For Post/Carousel: require at least one carousel image instead
      if (checked) {
        const contentTypeName = contentTypes.find(type => type.id === plan.content_type_id)?.name || '';
        const isPostOrCarousel = contentTypeName === 'Post' || contentTypeName === 'Carousel';
        if (isPostOrCarousel) {
          if (carouselImageCount < 1) {
            toast({
              variant: "destructive",
              title: "Cannot Approve Production",
              description: "Please add at least one carousel image before approving production."
            });
            setIsUpdatingProductionApproved(false);
            return;
          }
        } else {
          const googleDriveLink = plan.google_drive_link;
          if (!googleDriveLink || googleDriveLink.trim() === '') {
            toast({
              variant: "destructive",
              title: "Cannot Approve Production",
              description: "Please provide a Google Drive link before approving production. The Google Drive link is required for production approval."
            });
            setIsUpdatingProductionApproved(false);
            return;
          }
        }
      }

      // Prepare all updates in a single batch
      const batchUpdates: any = {
        production_approved: checked
      };

      if (checked) {
        // When production approved is checked, automatically set production status to "Approved"
        // and set the approved date
        const approvedDate = new Date().toISOString();
        batchUpdates.production_status = 'Approved';
        batchUpdates.production_approved_date = approvedDate;
      } else {
        // When production approved is unchecked, clear the approved date
        batchUpdates.production_approved_date = null;
        // If current production status is "Approved", change it to "Need Review"
        if (plan.production_status === 'Approved') {
          batchUpdates.production_status = 'Need Review';
        }
      }

      // OPTIMIZED: Single update call with all fields batched
      // This reduces database roundtrips and trigger executions
      // The batch update in handleFieldChange will collect these and send as one mutation
      onFieldChange(plan.id, 'production_approved', checked);
      
      // Update related fields - these will be batched together by handleFieldChange
      if (batchUpdates.production_status) {
        onProductionStatusChange(plan.id, batchUpdates.production_status);
      }
      if (batchUpdates.production_approved_date !== undefined) {
        onFieldChange(plan.id, 'production_approved_date', batchUpdates.production_approved_date);
      }
    } catch (error) {
      devLog.error('Error updating production approved:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update production approved status"
      });
    } finally {
      // Reset loading state quickly for better UX
      setTimeout(() => {
        setIsUpdatingProductionApproved(false);
      }, 150);
    }
  };
  const handleGoogleDriveLinkClick = () => {
    if (!plan.approved) return; // Don't open if not approved
    setIsGoogleDriveDialogOpen(true);
  };
  const handleSocialLinksClick = () => {
    if (!plan.production_approved) return; // Don't open if production not approved
    setIsSocialLinksDialogOpen(true);
  };

  // UPDATED: Google Drive Link save handler with auto production status logic
  const handleGoogleDriveLinkSave = (link: string) => {
    handleGoogleDriveLinkChange(link);
  };

  // Open Brief via page-level dialog so modal state survives row unmount/refetch
  const handleBriefClick = () => {
    onOpenBriefDialog(plan.id, plan.brief);
  };

  // Only log PIC checks if there's a mismatch (pic_id exists but employee not found)
  if (plan.pic_id && !selectedPIC) {
    logger.rateLimited(`pic-missing:${plan.id}`, 5000, () => {
      devLog.debug('⚠️ PIC employee not found:', {
        plan_id: plan.id,
        pic_id: plan.pic_id
      });
    });
  }
  const isSelected = selectedItems.includes(plan.id);

  const selectTriggerRow = isSelected
    ? 'h-8 rounded-[5px] border border-white bg-transparent text-left text-xs text-white shadow-none ring-offset-0 hover:bg-white/10 focus:ring-2 focus:ring-white/50 focus:ring-offset-0 data-[placeholder]:text-white/75 disabled:border-white/45 disabled:text-white/65 disabled:opacity-100 [&>span]:text-inherit [&_svg]:text-white [&_svg]:opacity-90'
    : 'h-8 rounded-[5px] border border-gray-200 bg-white text-left text-xs';

  const staticCellBox = (extra?: string) =>
    cn(
      'flex h-8 items-center justify-center rounded-[5px] border px-2',
      isSelected ? 'border-white bg-transparent' : 'border-gray-200 bg-white',
      extra
    );

  const staticCellMutedText = isSelected ? 'text-xs text-white' : 'text-xs text-gray-600';

  const switchOnSelectedRow = isSelected
    ? 'border border-white/60 data-[state=unchecked]:border-white/35 data-[state=unchecked]:bg-white/15 data-[state=checked]:border-white data-[state=checked]:bg-white'
    : undefined;

  return <>
      <tr
        className={cn(
          isSelected
            ? 'bg-primary shadow-md hover:bg-primary/95 [&_td]:border-white/25'
            : 'hover:bg-gray-50'
        )}
      >
        {/* Checkbox */}
        <td style={{
        width: '48px',
        minWidth: '48px',
        maxWidth: '48px'
      }} className="px-2 py-1 text-center border-r border-b border-gray-200">
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            className={
              isSelected
                ? 'border-white data-[state=checked]:bg-white data-[state=checked]:text-primary data-[state=unchecked]:bg-white/10'
                : undefined
            }
          />
        </td>

        {/* POINT 4: Post Date - No longer locked when approved */}
        <td style={{
        width: '160px',
        minWidth: '160px',
        maxWidth: '160px'
      }} className="px-2 py-1 border-r border-b border-gray-200">
          <PostDateCell postDate={plan.post_date} onDateChange={date => onFieldChange(plan.id, 'post_date', date)} isSelected={isSelected} />
        </td>

        {/* PIC */}
        <td style={{
        width: '180px',
        minWidth: '180px',
        maxWidth: '180px'
      }} className="px-2 py-1 border-r border-b border-gray-200">
          <PICCell picId={plan.pic_id} isPICLocked={isPICLocked} employees={picEmployees} selectedPIC={selectedPIC} onPICChange={value => onFieldChange(plan.id, 'pic_id', value)} isSelected={isSelected} />
        </td>

        {/* POINT 4: Content Type - No longer locked when approved */}
        <td style={{
        width: '180px',
        minWidth: '180px',
        maxWidth: '180px'
      }} className="px-2 py-1 border-r border-gray-200 border-b border-gray-200">
          <Select value={plan.content_type_id || 'placeholder'} onValueChange={value => {
          if (value === 'placeholder') return;
          onFieldChange(plan.id, 'content_type_id', value);
        }}>
              <SelectTrigger className={selectTriggerRow}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="placeholder" disabled>Select Type</SelectItem>
                {contentTypes.map(type => <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>)}
              </SelectContent>
            </Select>
        </td>

        {/* POINT 4: Service - No longer locked when approved */}
        <td style={{
        width: '180px',
        minWidth: '180px',
        maxWidth: '180px'
      }} className="px-2 py-1 border-r border-gray-200 border-b border-gray-200">
          <Select value={plan.service_id || 'placeholder'} onValueChange={value => {
          if (value === 'placeholder') return;
          onFieldChange(plan.id, 'service_id', value);
          onFieldChange(plan.id, 'sub_service_id', null);
        }}>
              <SelectTrigger className={selectTriggerRow}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="placeholder" disabled>Select Service</SelectItem>
                {services.map(service => <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>)}
              </SelectContent>
            </Select>
        </td>

        {/* POINT 4: Sub Service - No longer locked when approved */}
        <td style={{
        width: '180px',
        minWidth: '180px',
        maxWidth: '180px'
      }} className="px-2 py-1 border-r border-gray-200 border-b border-gray-200">
          <Select value={plan.sub_service_id || 'placeholder'} onValueChange={value => {
          if (value === 'placeholder') return;
          onFieldChange(plan.id, 'sub_service_id', value);
        }} disabled={!plan.service_id}>
              <SelectTrigger className={selectTriggerRow}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="placeholder" disabled>Select Sub Service</SelectItem>
                {(getFilteredSubServices ? getFilteredSubServices(plan.service_id) : subServices.filter(sub => sub.service_id === plan.service_id)).map(subService => <SelectItem key={subService.id} value={subService.id}>
                    {subService.name}
                  </SelectItem>)}
              </SelectContent>
            </Select>
        </td>

        {/* POINT 4: Title - No longer locked when approved */}
        <td style={{
        width: '280px',
        minWidth: '280px',
        maxWidth: '280px'
      }} className="px-2 py-1 border-r border-gray-200 border-b border-gray-200">
          <Button
            variant="ghost"
            className={cn(
              'h-8 w-full justify-start rounded-[5px] border px-2 text-xs',
              isSelected
                ? 'border-white bg-transparent text-white hover:bg-white/10 hover:text-white'
                : 'border-gray-200 hover:bg-gray-50'
            )}
            onClick={() => onOpenTitleDialog(plan.id, plan.title, plan.approved)}
          >
              <span className="block w-full truncate text-left">
                {plan.title || 'Click to add title...'}
              </span>
            </Button>
        </td>

        {/* POINT 4: Content Pillar - No longer locked when approved */}
        <td style={{
        width: '180px',
        minWidth: '180px',
        maxWidth: '180px'
      }} className="px-2 py-1 border-r border-gray-200 border-b border-gray-200">
          <Select value={plan.content_pillar_id || 'placeholder'} onValueChange={value => {
          if (value === 'placeholder') return;
          onFieldChange(plan.id, 'content_pillar_id', value);
        }}>
              <SelectTrigger className={selectTriggerRow}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="placeholder" disabled>Select Pillar</SelectItem>
                {contentPillars.map(pillar => <SelectItem key={pillar.id} value={pillar.id}>
                    {pillar.name}
                  </SelectItem>)}
              </SelectContent>
            </Select>
        </td>

        {/* POINT 4: Brief - No longer locked when approved */}
        <td style={{
        width: '160px',
        minWidth: '160px',
        maxWidth: '160px'
      }} className="px-2 py-1 border-r border-gray-200 border-b border-gray-200">
          <BriefPreview brief={plan.brief} onClick={handleBriefClick} isSelected={isSelected} />
        </td>

        {/* POINT 4: Status - No longer locked when approved */}
        <td style={{
        width: '180px',
        minWidth: '180px',
        maxWidth: '180px'
      }} className="px-2 py-1 border-r border-gray-200 border-b border-gray-200">
          <Select
            value={plan.approved ? 'Approved' : (plan.status || 'none')}
            onValueChange={value => {
              if (value === 'none') {
                if (plan.approved) {
                  onFieldChange(plan.id, 'completion_date', null);
                  onFieldChange(plan.id, 'approved', false);
                }
                onStatusChange(plan.id, '');
                return;
              }
              if (plan.approved && value !== 'Approved') {
                onFieldChange(plan.id, 'completion_date', null);
                onFieldChange(plan.id, 'approved', false);
                onStatusChange(plan.id, value);
                return;
              }
              onStatusChange(plan.id, value);
            }}
          >
              <SelectTrigger className={selectTriggerRow}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Status</SelectItem>
                <SelectItem value="Need Review">Need Review</SelectItem>
                {showApprovalOptions.status && <>
                    <SelectItem value="Request Revision">Request Revision</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                  </>}
              </SelectContent>
            </Select>
        </td>

        {/* POINT 4: Revision Count - No longer locked when approved */}
        <td style={{
        width: '96px',
        minWidth: '96px',
        maxWidth: '96px'
      }} className="px-2 py-1 border-r border-gray-200 border-b border-gray-200">
          <RevisionCounter count={plan.revision_count || 0} onReset={() => onResetRevision(plan.id, 'revision_count')} showResetButton={configLoaded && revisionConfigActive} isSelected={isSelected} />
        </td>

        {/* POINT 2: Approved - Check approval access configuration */}
        <td style={{
        width: '120px',
        minWidth: '120px',
        maxWidth: '120px'
      }} className="px-2 py-1 text-center border-r border-gray-200 border-b border-gray-200">
          <Switch
            checked={approvedInstant ?? (plan.approved || false)}
            onCheckedChange={handleApprovedChange}
            className={switchOnSelectedRow}
          />
        </td>

        {/* Completion Date - Center aligned */}
        <td style={{
        width: '180px',
        minWidth: '180px',
        maxWidth: '180px'
      }} className="px-2 py-1 text-center border-r border-gray-200 border-b border-gray-200">
          <div className={staticCellBox()}>
            <span className={staticCellMutedText}>
              {plan.completion_date ? formatDateTime(plan.completion_date) : '-'}
            </span>
          </div>
        </td>

        {/* PIC Production - Auto-populated only (no dropdown) */}
        <td style={{
        width: '160px',
        minWidth: '160px',
        maxWidth: '160px'
      }} className="px-2 py-1 border-r border-gray-200 border-b border-gray-200">
          {selectedProductionPIC?.full_name ? (
            <div
              className={cn(
                'flex h-8 items-center gap-2 rounded-[5px] border px-3 text-xs',
                isSelected ? 'border-white bg-transparent text-white' : 'border-primary/20 bg-accent text-primary'
              )}
            >
              <User className={cn('h-3 w-3', isSelected ? 'text-white' : 'text-primary')} />
              <span className={cn('font-medium', isSelected ? 'text-white' : 'text-primary')}>
                {selectedProductionPIC.full_name}
              </span>
            </div>
          ) : (
            <div
              className={cn(
                'flex h-8 items-center justify-center rounded-[5px] border px-3 text-xs',
                isSelected ? 'border-white/50 bg-transparent text-white/75' : 'border-gray-200 bg-gray-100 text-gray-500'
              )}
            >
              Auto-populated
            </div>
          )}
        </td>

        {/* POINT 3: Google Drive Link - No longer locked when production approved */}
        <td style={{
        width: '280px',
        minWidth: '280px',
        maxWidth: '280px'
      }} className="px-2 py-1 text-center border-r border-gray-200 border-b border-gray-200">
          <GoogleDriveLinkCell googleDriveLink={plan.google_drive_link} isDisabled={isGoogleDriveLinkDisabled} onClick={() => {
          if (!plan.approved) return; // Don't open if not approved
          setIsGoogleDriveDialogOpen(true);
        }} isSelected={isSelected} contentType={contentTypeName} carouselImageCount={carouselImageCount} />
        </td>

        {/* POINT 3: Production Status - No longer locked when production approved; display in sync with APPROVED */}
        <td style={{
        width: '180px',
        minWidth: '180px',
        maxWidth: '180px'
      }} className="px-2 py-1 border-r border-gray-200 border-b border-gray-200">
          <Select
            value={
              plan.production_approved
                ? 'Approved'
                : plan.production_status ||
                  (plan.google_drive_link && String(plan.google_drive_link).trim().length > 0
                    ? 'Need Review'
                    : 'none')
            }
            onValueChange={value => {
              if (value === 'none') {
                onProductionStatusChange(plan.id, null);
              } else {
                onProductionStatusChange(plan.id, value);
              }
            }}
          >
              <SelectTrigger className={selectTriggerRow}>
                <SelectValue placeholder="No Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Status</SelectItem>
                <SelectItem value="Need Review">Need Review</SelectItem>
                {showApprovalOptions.production_status && <>
                    <SelectItem value="Request Revision">Request Revision</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                  </>}
              </SelectContent>
            </Select>
        </td>

        {/* POINT 3: Production Revision Count - No longer locked when production approved */}
        <td style={{
        width: '96px',
        minWidth: '96px',
        maxWidth: '96px'
      }} className="px-2 py-1 border-r border-gray-200 border-b border-gray-200">
          <RevisionCounter count={plan.production_revision_count || 0} onReset={() => onResetRevision(plan.id, 'production_revision_count')} showResetButton={configLoaded && productionRevisionConfigActive} isSelected={isSelected} />
        </td>

        {/* POINT 3: Production Approved - Check approval access configuration */}
        <td style={{
        width: '120px',
        minWidth: '120px',
        maxWidth: '120px'
      }} className="px-2 py-1 text-center border-r border-gray-200 border-b border-gray-200">
          <Switch
            checked={plan.production_approved || false}
            onCheckedChange={handleProductionApprovedChange}
            disabled={!canApproveProduction || isUpdatingProductionApproved}
            className={switchOnSelectedRow}
          />
          {!canApproveProduction}
        </td>

        {/* Production Completion Date - Center aligned */}
        <td style={{
        width: '180px',
        minWidth: '180px',
        maxWidth: '180px'
      }} className="px-2 py-1 text-center border-r border-gray-200 border-b border-gray-200">
          <div className={staticCellBox()}>
            <span className={staticCellMutedText}>
              {plan.production_completion_date ? formatDateTime(plan.production_completion_date) : '-'}
            </span>
          </div>
        </td>

        {/* POINT 1: Production Approved Date - Center aligned, shows real-time data, FIXED clearing logic */}
        <td style={{
        width: '180px',
        minWidth: '180px',
        maxWidth: '180px'
      }} className="px-2 py-1 text-center border-r border-gray-200 border-b border-gray-200">
          <div className={staticCellBox()}>
            <span className={staticCellMutedText}>
              {plan.production_approved_date ? formatDateTime(plan.production_approved_date) : '-'}
            </span>
          </div>
        </td>

        {/* Post Link - Social media links dialog using table data */}
        <td style={{
        width: '280px',
        minWidth: '280px',
        maxWidth: '280px'
      }} className="px-2 py-1 border-r border-gray-200 border-b border-gray-200">
          <PostLinkCell planId={plan.id} isDisabled={isPostLinkDisabled} onSocialLinksClick={() => {
          if (!plan.production_approved) return; // Don't open if production not approved
          setIsSocialLinksDialogOpen(true);
        }} isSelected={isSelected} productionApproved={plan.production_approved || false} />
        </td>

        {/* PIC POST - Show employee who added first link */}
        <td style={{
        width: '180px',
        minWidth: '180px',
        maxWidth: '180px'
      }} className="px-2 py-1 text-center border-r border-gray-200 border-b border-gray-200">
          <div className={staticCellBox()}>
            <span className={staticCellMutedText}>
              {plan.post_link_creator?.full_name || '-'}
            </span>
          </div>
        </td>

        {/* Done - Auto-controlled by Social Media Links */}
        <td style={{
        width: '64px',
        minWidth: '64px',
        maxWidth: '64px'
      }} className="px-2 py-1 text-center border-r border-gray-200 border-b border-gray-200">
          <Switch
            checked={links && links.length > 0}
            onCheckedChange={() => {}}
            disabled={true}
            className={switchOnSelectedRow}
          />
        </td>

        {/* Actual Post Date - Show actual post date when links exist */}
        <td style={{
        width: '160px',
        minWidth: '160px',
        maxWidth: '160px'
      }} className="px-2 py-1 text-center border-r border-gray-200 border-b border-gray-200">
          <div className={staticCellBox()}>
            <span className={staticCellMutedText}>
              {displayActualPostDate()}
            </span>
          </div>
        </td>

        {/* On Time Status - FIXED: Calculate and display real-time status */}
        <td style={{
        width: '160px',
        minWidth: '160px',
        maxWidth: '160px'
      }} className="px-2 py-1 text-center border-r border-gray-200 border-b border-gray-200">
          <div className={staticCellBox()}>
            <span
              className={cn(
                'text-xs font-medium',
                isSelected
                  ? 'text-white'
                  : displayOnTimeStatus().includes('Late')
                    ? 'text-red-600'
                    : displayOnTimeStatus() === 'Ontime'
                      ? 'text-green-600'
                      : 'text-gray-600'
              )}
            >
              {displayOnTimeStatus() || '-'}
            </span>
          </div>
        </td>

        {/* Status Content - Now with dropdown */}
        <td style={{
        width: '160px',
        minWidth: '160px',
        maxWidth: '160px'
      }} className="px-2 py-1 border-b border-gray-200">
          <Select value={plan.status_content || 'none'} onValueChange={value => onStatusContentChange(plan.id, value)}>
            <SelectTrigger className={selectTriggerRow}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Status</SelectItem>
              <SelectItem value="Cancel">Cancel</SelectItem>
              <SelectItem value="Recomended For Ads">Recomended For Ads</SelectItem>
            </SelectContent>
          </Select>
        </td>
      </tr>

      {/* POINT 3: Google Drive Link Dialog - Pass sync handlers for production approval */}
      <GoogleDriveLinkDialog isOpen={isGoogleDriveDialogOpen} onClose={() => setIsGoogleDriveDialogOpen(false)} googleDriveLink={plan.google_drive_link || ''} productionApproved={plan.production_approved || false} productionStatus={plan.production_status ?? undefined} onSave={link => {
        // Normalize: Convert empty string to null for consistency
        const normalizedLink = link && link.trim().length > 0 ? link : null;
        devLog.debug('📝 GoogleDriveLinkDialog onSave called:', {
          planId: plan.id,
          link: normalizedLink
        });
        // onFieldChange for google_drive_link: when value is set, parent sends ONE update with
        // google_drive_link + production_status 'Need Review' + production_completion_date (so DB trigger allows it).
        // When cleared, parent clears link and production_status in one update.
        onFieldChange(plan.id, 'google_drive_link', normalizedLink);
        if (!normalizedLink) {
          onProductionStatusChange(plan.id, null);
        }
    }} socialMediaPlanId={plan.id} planTitle={plan.title} contentTitle={plan.title} contentType={contentTypeName} postDate={plan.post_date}
    serviceName={plan.service?.name ?? null}
    picProductionName={plan.pic_production?.full_name ?? null}
    onCarouselChange={onCarouselChange}
    onCarouselFirstUploadSuccess={onCarouselFirstUploadSuccess}
    onCarouselAllRemoved={onCarouselAllRemoved}
    revisionBaselineLink={plan.production_revision_baseline_link ?? null}
    onResubmitForReview={
      onProductionResubmitForReview
        ? () => onProductionResubmitForReview(plan.id)
        : undefined
    }
    onApprove={() => {
      const approvedDate = new Date().toISOString();
      onFieldChange(plan.id, 'production_approved', true);
      onFieldChange(plan.id, 'production_approved_date', approvedDate);
      onProductionStatusChange(plan.id, 'Approved');
    }} />

      {/* Social Media Links Dialog */}
      <SocialMediaLinksDialog isOpen={isSocialLinksDialogOpen} onClose={() => setIsSocialLinksDialogOpen(false)} socialMediaPlanId={plan.id} planTitle={plan.title} />

      {/* Auto-create Branding Plan task when approved toggled ON and not exists - uses DailyTaskProvider from dashboard */}
      <CreateTaskDialog
        open={isCreateTaskOpen}
        onOpenChange={(open) => {
          setIsCreateTaskOpen(open);
          if (!open) {
            // Immediate visual rollback to reflect cancellation
            setApprovedInstant(false);
            // After dialog closed, recheck existence; rollback toggle if task still not found
            void recheckOrRollbackAfterCreateClose();
          }
        }}
        defaultTitle={createPrefillTitle}
        defaultPlanDate={plan.post_date ? new Date(plan.post_date) : null}
      />
    </>;
});
ContentPlanRow.displayName = 'ContentPlanRow';