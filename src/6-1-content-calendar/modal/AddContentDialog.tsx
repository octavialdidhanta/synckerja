import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { EditableBriefTable } from '@/6-1-dashboard/modal/EditableBriefTable';
import { BriefStoryboardEmptyState } from '@/6-1-dashboard/modal/BriefStoryboardEmptyState';
import { CreateBriefTableDialog } from '@/6-1-dashboard/modal/CreateBriefTableDialog';
import {
  parseMarkdownTable,
  replaceTableInMarkdown,
  stringifyMarkdownTable,
} from '@/6-1-dashboard/utils/markdownTableUtils';
import {
  isBriefStoryboardTableCanonical,
  normalizeBriefStoryboardTable,
} from '@/6-1-dashboard/modal/briefStoryboardConstants';
import { upsertBriefSequencesInMarkdown, type BriefSequence } from '@/6-1-dashboard/modal/briefSequences';
import {
  upsertBriefSceneMetaInMarkdown,
  type BriefSceneMeta,
} from '@/6-1-dashboard/modal/briefSceneMeta';
import { useToast } from '@/shared/components/ui/use-toast';
import { useSocialMediaMutations } from '@/6-1-dashboard/hook/useOptimizedSocialMediaState';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import { format } from 'date-fns';
import { ContentPlan } from '@/6-1-dashboard/types/social-media';
import { isEmployeeActive } from '@/2-1-employees/utils/employeeUtils';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';
import { ChevronDown, X } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/components/ui/drawer';
import { MobileContentPillarPickerField } from '@/mobile/6-1-content-calendar/components/MobileContentPillarPickerField';
import './AddContentDialog.css';

type AddContentSelectOption = {
  id: string;
  label: string;
  leading?: React.ReactNode;
};

function AddContentSelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled = false,
  isMobile,
  emptyText,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: AddContentSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  isMobile: boolean;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value);

  if (isMobile) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="h-8 w-full justify-between px-2.5 text-xs font-normal"
        >
          <span className={cn('flex min-w-0 items-center gap-2 truncate', !selected && 'text-muted-foreground')}>
            {selected?.leading}
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
        <Drawer shouldScaleBackground={false} open={open} onOpenChange={setOpen}>
          <DrawerContent
            className="z-[1000003] max-h-[85vh] px-0 pb-4"
            overlayClassName="z-[1000002]"
          >
            <DrawerHeader className="px-4 pb-2 text-left">
              <DrawerTitle className="text-base">{label}</DrawerTitle>
            </DrawerHeader>
            <div className="scrollbar-hide max-h-[min(60vh,420px)] overflow-y-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {options.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
              ) : (
                options.map((option) => {
                  const isSelected = option.id === value;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm',
                        isSelected ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted',
                      )}
                      onClick={() => {
                        onChange(option.id);
                        setOpen(false);
                      }}
                    >
                      {option.leading}
                      <span className="min-w-0 truncate">{option.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent
          className="max-h-[200px] overflow-y-auto"
          position="popper"
          sideOffset={4}
          style={{ zIndex: 999999 }}
        >
          {options.length > 0 ? (
            options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                <span className="flex items-center gap-2">
                  {option.leading}
                  {option.label}
                </span>
              </SelectItem>
            ))
          ) : (
            <SelectItem value="__empty" disabled>
              {emptyText}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

function statusNameFromJoin(row: {
  employee_statuses?: { name?: string } | { name?: string }[] | null;
}) {
  const es = row.employee_statuses;
  if (!es) return null;
  if (Array.isArray(es)) return es[0]?.name ?? null;
  return es.name ?? null;
}

interface AddContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  editingPlan?: ContentPlan | null; // Plan to edit, null means create mode
  /** Calendar service filter; used by the mobile pillar tracker picker. */
  serviceFilter?: string;
}

interface Employee {
  id: string;
  full_name: string;
  user_id: string;
}

export const AddContentDialog: React.FC<AddContentDialogProps> = ({
  open,
  onOpenChange,
  selectedDate,
  editingPlan = null,
  serviceFilter = 'all',
}) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { organizationId } = useCurrentOrg();
  const { addContentPlan, updateContentPlan } = useSocialMediaMutations();
  const isEditMode = !!editingPlan;
  const trackerMonth = useMemo(() => {
    if (editingPlan?.post_date) return new Date(editingPlan.post_date);
    if (selectedDate) return selectedDate;
    return new Date();
  }, [editingPlan?.post_date, selectedDate]);
  
  // State for master data - simplified approach
  const [contentTypes, setContentTypes] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [subServices, setSubServices] = useState<any[]>([]);
  const [contentPillars, setContentPillars] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    brief: '',
    service_id: '',
    sub_service_id: '',
    content_pillar_id: '',
    content_type_id: '',
    pic_id: '',
    post_date: ''
  });
  const [filteredSubServices, setFilteredSubServices] = useState<any[]>([]);
  const [createTableOpen, setCreateTableOpen] = useState(false);

  // Simplified master data loading function
  const loadMasterData = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      // Fetch all master data in parallel
      const [contentTypesResult, servicesResult, subServicesResult, contentPillarsResult, employeesResult] = await Promise.all([
        supabase
          .from('content_types')
          .select('*')
          .or(`organization_id.eq.${organizationId},organization_id.is.null`)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('services')
          .select('*')
          .or(`organization_id.eq.${organizationId},organization_id.is.null`)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('sub_services')
          .select('*')
          .or(`organization_id.eq.${organizationId},organization_id.is.null`)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('content_pillars')
          .select('*')
          .or(`organization_id.eq.${organizationId},organization_id.is.null`)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('employees')
          .select(`
            id,
            full_name,
            user_id,
            pending_removal,
            employee_statuses!left(name)
          `)
          .eq('organization_id', organizationId)
          .order('full_name')
      ]);

      // Check for errors
      if (contentTypesResult.error) throw contentTypesResult.error;
      if (servicesResult.error) throw servicesResult.error;
      if (subServicesResult.error) throw subServicesResult.error;
      if (contentPillarsResult.error) throw contentPillarsResult.error;
      if (employeesResult.error) throw employeesResult.error;

      setContentTypes(contentTypesResult.data || []);
      setServices(servicesResult.data || []);
      setSubServices(subServicesResult.data || []);
      setContentPillars(contentPillarsResult.data || []);
      const empRows = (employeesResult.data ?? []) as Array<
        Employee & { pending_removal?: boolean | null; employee_statuses?: unknown }
      >;
      setEmployees(
        empRows
          .filter((row) =>
            isEmployeeActive({
              employee_status_name: statusNameFromJoin(row),
              status: null,
              pending_removal: row.pending_removal,
            })
          )
          .map(({ id, full_name, user_id }) => ({ id, full_name, user_id }))
      );
    } catch (error) {
      console.error('Error loading master data:', error);
      toast({
        title: "Error",
        description: "Failed to load master data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  // Load master data when modal opens
  useEffect(() => {
    if (open && organizationId) {
      loadMasterData();
    }
  }, [open, organizationId, loadMasterData]);

  // Filter sub services based on selected service
  useEffect(() => {
    if (formData.service_id && subServices.length > 0) {
      const filtered = subServices.filter(subService => 
        subService.service_id === formData.service_id
      );
      setFilteredSubServices(filtered);
    } else {
      setFilteredSubServices([]);
    }
  }, [formData.service_id, subServices]);

  // Fetch current user's employee profile
  useEffect(() => {
    const fetchCurrentEmployee = async () => {
      if (!organizationId) return;
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: row, error } = await supabase
          .from('employees')
          .select(`
            id,
            full_name,
            user_id,
            pending_removal,
            employee_statuses!left(name)
          `)
          .eq('user_id', user.id)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching employee:', error);
          return;
        }

        const employee =
          row &&
          isEmployeeActive({
            employee_status_name: statusNameFromJoin(row),
            status: null,
            pending_removal: row.pending_removal,
          })
            ? { id: row.id, full_name: row.full_name, user_id: row.user_id }
            : null;

        setCurrentEmployee(employee);
        
        // Create mode: set default PIC to current employee
        if (!isEditMode && employee) {
          setFormData(prev => ({
            ...prev,
            pic_id: employee.id
          }));
        }
      } catch (error) {
        console.error('Error fetching current employee:', error);
      }
    };

    if (open && organizationId && !isEditMode) {
      fetchCurrentEmployee();
    }
  }, [open, organizationId, isEditMode]);

  // Populate form for edit mode
  useEffect(() => {
    if (open && isEditMode && editingPlan) {
      const postDate = editingPlan.post_date ? new Date(editingPlan.post_date) : selectedDate;
      setFormData({
        title: editingPlan.title || '',
        brief: editingPlan.brief || '',
        service_id: editingPlan.service_id || '',
        sub_service_id: editingPlan.sub_service_id || '',
        content_pillar_id: editingPlan.content_pillar_id || '',
        content_type_id: editingPlan.content_type_id || '',
        pic_id: editingPlan.pic_id || '',
        post_date: postDate ? format(postDate, 'yyyy-MM-dd') : ''
      });
    }
  }, [open, isEditMode, editingPlan, selectedDate]);

  // Filter sub services based on selected service
  useEffect(() => {
    if (formData.service_id) {
      const filtered = subServices.filter(sub => sub.service_id === formData.service_id);
      setFilteredSubServices(filtered);
    } else {
      setFilteredSubServices([]);
      setFormData(prev => ({ ...prev, sub_service_id: '' }));
    }
  }, [formData.service_id, subServices]);

  // Reset form when modal closes (only in create mode)
  useEffect(() => {
    if (!open && !isEditMode) {
      setFormData({
        title: '',
        brief: '',
        service_id: '',
        sub_service_id: '',
        content_pillar_id: '',
        content_type_id: '',
        pic_id: currentEmployee?.id || '',
        post_date: ''
      });
      setCreateTableOpen(false);
      setLoading(false);
    }
  }, [open, isEditMode, currentEmployee?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!organizationId) {
      toast({
        title: "Error",
        description: "Missing organization data",
        variant: "destructive"
      });
      return;
    }

    if (!formData.title.trim()) {
      toast({
        title: "Error", 
        description: "Title is required",
        variant: "destructive"
      });
      return;
    }

    // Determine the date to use
    let dateToUse: Date | null = null;
    
    if (isEditMode && editingPlan) {
      // Edit mode: use formData.post_date if available, otherwise use original post_date
      if (formData.post_date) {
        dateToUse = new Date(formData.post_date);
      } else if (editingPlan.post_date) {
        dateToUse = new Date(editingPlan.post_date);
      } else if (selectedDate) {
        dateToUse = selectedDate;
      }
      
      // Validation: Check if post_date can be changed (if approved, cannot change)
      const isApproved = editingPlan.approved === true;
      if (isApproved && formData.post_date) {
        const originalPostDate = editingPlan.post_date ? format(new Date(editingPlan.post_date), 'yyyy-MM-dd') : '';
        const newPostDate = format(new Date(formData.post_date), 'yyyy-MM-dd');
        
        if (originalPostDate !== newPostDate) {
          toast({
            title: "Error",
            description: "Cannot change post date for approved content plan",
            variant: "destructive"
          });
          return;
        }
      }
    } else {
      // Create mode: use selectedDate
      dateToUse = selectedDate;
    }
    
    if (!dateToUse) {
      toast({
        title: "Error",
        description: "Missing post date",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      if (isEditMode && editingPlan) {
        // Update existing content plan
        const updateData: Partial<ContentPlan> = {
          title: formData.title.trim(),
          brief: formData.brief.trim() || null,
          service_id: formData.service_id || null,
          sub_service_id: formData.sub_service_id || null,
          content_pillar_id: formData.content_pillar_id || null,
          content_type_id: formData.content_type_id || null,
          pic_id: formData.pic_id || null,
        };

        // Only update post_date if not approved
        if (!editingPlan.approved) {
          updateData.post_date = format(dateToUse, 'yyyy-MM-dd');
        }

        await updateContentPlan(editingPlan.id, updateData);
        
        toast({
          title: "Success",
          description: "Content plan updated successfully"
        });
      } else {
        // Create new content plan
        if (!currentEmployee) {
          toast({
            title: "Error", 
            description: "Employee information not found",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        const newContentData = {
          organization_id: organizationId,
          post_date: format(dateToUse, 'yyyy-MM-dd'),
          title: formData.title.trim(),
          brief: formData.brief.trim() || null,
          service_id: formData.service_id || null,
          sub_service_id: formData.sub_service_id || null,
          content_pillar_id: formData.content_pillar_id || null,
          content_type_id: formData.content_type_id || null,
          pic_id: formData.pic_id || null,
          status: "",
          revision_count: 0,
          approved: false,
          completion_date: null,
          pic_production_id: null,
          google_drive_link: null,
          production_status: "",
          production_revision_count: 0,
          production_completion_date: null,
          production_approved: false,
          production_approved_date: null,
          post_link: null,
          done: false,
          actual_post_date: null,
          on_time_status: "",
          status_content: ""
        };

        await addContentPlan(newContentData);
        
        toast({
          title: "Success",
          description: "Content plan created successfully"
        });
        
        // Reset form
        setFormData({
          title: '',
          brief: '',
          service_id: '',
          sub_service_id: '',
          content_pillar_id: '',
          content_type_id: '',
          pic_id: currentEmployee.id,
          post_date: ''
        });
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} content plan:`, error);
      toast({
        title: "Error",
        description: `Failed to ${isEditMode ? 'update' : 'create'} content plan`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const parsedBriefTable = useMemo(() => {
    const briefText = formData.brief.trim();
    if (!briefText) return null;
    const parsed = parseMarkdownTable(briefText);
    if (!parsed?.table?.length) return parsed;
    if (isBriefStoryboardTableCanonical(parsed.table)) return parsed;
    return {
      ...parsed,
      table: normalizeBriefStoryboardTable(parsed.table),
    };
  }, [formData.brief]);

  const handleCreateStoryboardTable = (tableData: string[][]) => {
    const markdown = stringifyMarkdownTable(tableData, { trimTrailingEmptyBodyRows: false });
    setFormData((prev) => {
      const existing = parseMarkdownTable(prev.brief);
      if (existing) {
        return {
          ...prev,
          brief: replaceTableInMarkdown(prev.brief, markdown, existing.startIndex, existing.endIndex),
        };
      }
      const trimmed = prev.brief.trim();
      return { ...prev, brief: trimmed ? `${trimmed}\n\n${markdown}` : markdown };
    });
    setCreateTableOpen(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton={isMobile}
        fullscreenAnimation={isMobile}
        className={cn(
          'flex flex-col overflow-hidden p-0',
          isMobile
            ? 'fixed left-0 right-0 top-0 h-dvh max-h-none min-h-0 w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 modal-above-safe-area'
            : 'max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-6xl',
        )}
        style={{ zIndex: 999999 }}
      >
        {/* Sticky Header */}
        <DialogHeader
          className={cn(
            'z-10 flex-shrink-0 space-y-0 border-b bg-background text-left',
            isMobile
              ? 'safe-area-top flex h-12 flex-row items-center justify-between gap-2 px-4 py-0'
              : 'px-6 pb-4 pt-6',
          )}
        >
          <DialogTitle
            className={cn(
              'min-w-0 flex-1',
              isMobile && 'truncate text-sm font-semibold leading-none',
            )}
          >
            {isEditMode ? 'Edit Content Plan' : 'Add New Content Plan'}
            {selectedDate ? (
              <span className={cn('font-medium', isMobile ? 'text-muted-foreground' : '')}>
                {' - '}
                {format(selectedDate, 'dd MMMM yyyy')}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className={cn(isMobile ? 'sr-only' : undefined)}>
            {isEditMode 
              ? 'Edit the content plan details. Fill in all required fields to save your changes.'
              : 'Create a new content plan for the selected date. Fill in all required fields to save your content plan.'}
          </DialogDescription>
          {isMobile ? (
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
                disabled={loading}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          ) : null}
        </DialogHeader>

        {/* Scrollable Content */}
        <div className={cn('flex-1 min-h-0 overflow-y-auto seamless-scroll', isMobile ? 'px-4' : 'px-6')}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading master data...</p>
              </div>
            </div>
          ) : (
          <form onSubmit={handleSubmit} id="content-plan-form" className={cn(isMobile ? 'space-y-2.5 py-3' : 'space-y-4 py-4')}>
          {/* Post Date - Only show in edit mode, and disable if approved */}
          {isEditMode && editingPlan && (
            <div className={cn(isMobile ? 'space-y-1.5' : 'space-y-2')}>
              <Label htmlFor="post_date" className={cn(isMobile && 'text-xs')}>
                Post Date {editingPlan.approved && '(Cannot change - Already approved)'}
              </Label>
              <Input
                id="post_date"
                type="date"
                value={formData.post_date}
                onChange={(e) => setFormData(prev => ({ ...prev, post_date: e.target.value }))}
                disabled={editingPlan.approved === true}
                className={cn(editingPlan.approved && 'bg-muted', isMobile && 'h-8 text-xs')}
              />
              {editingPlan.approved && (
                <p className="text-xs text-muted-foreground">
                  Post date cannot be changed for approved content plans
                </p>
              )}
            </div>
          )}

          {/* Title */}
          <div className={cn(isMobile ? 'space-y-1.5' : 'space-y-2')}>
            <Label htmlFor="title" className={cn(isMobile && 'text-xs')}>Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter content title"
              required
              className={cn(isMobile && 'h-8 text-xs')}
            />
          </div>

          {/* Brief / storyboard table — same create-table flow as dashboard Brief Content */}
          <div className={cn(isMobile ? 'space-y-1.5' : 'space-y-2')}>
            <Label className={cn(isMobile && 'text-xs')}>Brief</Label>
            {parsedBriefTable ? (
              <div className={cn(isMobile && '-mx-4')}>
              <EditableBriefTable
                tableData={parsedBriefTable.table}
                storyboardToolbar
                density={isMobile ? 'mobile-2col' : 'desktop'}
                sequencesSource={formData.brief}
                planId={isEditMode ? editingPlan?.id : undefined}
                onSave={(
                  newTableData,
                  meta?: { sequences: BriefSequence[]; sceneMeta?: BriefSceneMeta[] },
                ) => {
                  const existing = parseMarkdownTable(formData.brief);
                  const markdown = stringifyMarkdownTable(newTableData, {
                    trimTrailingEmptyBodyRows: false,
                  });
                  let next = existing
                    ? replaceTableInMarkdown(
                        formData.brief,
                        markdown,
                        existing.startIndex,
                        existing.endIndex,
                      )
                    : markdown;
                  if (meta?.sequences) {
                    next = upsertBriefSequencesInMarkdown(next, meta.sequences);
                  }
                  if (meta?.sceneMeta) {
                    next = upsertBriefSceneMetaInMarkdown(next, meta.sceneMeta);
                  }
                  setFormData((prev) => ({ ...prev, brief: next }));
                }}
                className="!my-0"
              />
              </div>
            ) : (
              <div className={cn(isMobile && '[&_p]:text-xs [&_button]:h-8 [&_button]:text-xs')}>
                <BriefStoryboardEmptyState onCreateTable={() => setCreateTableOpen(true)} />
              </div>
            )}
          </div>

          <AddContentSelectField
            label="Service"
            value={formData.service_id}
            placeholder="Select service"
            emptyText="No services available"
            isMobile={isMobile}
            options={services.map((service) => ({ id: service.id, label: service.name }))}
            onChange={(value) => {
              setFormData((prev) => ({
                ...prev,
                service_id: value,
                sub_service_id: '',
              }));
            }}
          />

          <AddContentSelectField
            label="Sub Service"
            value={formData.sub_service_id}
            placeholder={formData.service_id ? 'Select sub service' : 'Please select service first'}
            emptyText="No sub services available"
            isMobile={isMobile}
            disabled={!formData.service_id}
            options={filteredSubServices.map((subService) => ({
              id: subService.id,
              label: subService.name,
            }))}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, sub_service_id: value }));
            }}
          />

          {isMobile ? (
            <MobileContentPillarPickerField
              label="Content Pillar"
              value={formData.content_pillar_id}
              placeholder="Select content pillar"
              selectedMonth={trackerMonth}
              serviceFilter={serviceFilter}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, content_pillar_id: value }));
              }}
            />
          ) : (
            <AddContentSelectField
              label="Content Pillar"
              value={formData.content_pillar_id}
              placeholder="Select content pillar"
              emptyText="No content pillars available"
              isMobile={false}
              options={contentPillars.map((pillar) => ({
                id: pillar.id,
                label: pillar.name,
                leading: pillar.color ? (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: pillar.color }}
                  />
                ) : undefined,
              }))}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, content_pillar_id: value }));
              }}
            />
          )}

          <AddContentSelectField
            label="Content Type"
            value={formData.content_type_id}
            placeholder="Select content type"
            emptyText="No content types available"
            isMobile={isMobile}
            options={contentTypes.map((type) => ({ id: type.id, label: type.name }))}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, content_type_id: value }));
            }}
          />

          <AddContentSelectField
            label="PIC"
            value={formData.pic_id}
            placeholder="Select PIC"
            emptyText="No employees available"
            isMobile={isMobile}
            options={employees.map((employee) => ({
              id: employee.id,
              label: employee.full_name,
            }))}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, pic_id: value }));
            }}
          />

          </form>
          )}
        </div>

        {/* Sticky Footer */}
        <div
          className={cn(
            'z-10 flex-shrink-0 border-t bg-background',
            isMobile ? 'px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'px-6 pb-6 pt-4',
          )}
        >
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size={isMobile ? 'sm' : 'default'}
              className={cn(isMobile && 'text-xs')}
              onClick={() => {
                if (!loading) {
                  onOpenChange(false);
                }
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              form="content-plan-form"
              size={isMobile ? 'sm' : 'default'}
              className={cn(isMobile && 'text-xs')}
              disabled={loading || !formData.pic_id}
            >
              {loading 
                ? (isEditMode ? 'Updating...' : 'Creating...') 
                : (isEditMode ? 'Update Content Plan' : 'Create Content Plan')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <CreateBriefTableDialog
      open={createTableOpen}
      onOpenChange={setCreateTableOpen}
      onCreate={handleCreateStoryboardTable}
      overlayClassName="z-[1000000]"
      contentClassName="z-[1000001]"
    />
    </>
  );
};