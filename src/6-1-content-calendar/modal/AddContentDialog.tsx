import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useToast } from '@/shared/components/ui/use-toast';
import { useSocialMediaMutations } from '@/6-1-dashboard/hook/useOptimizedSocialMediaState';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import { format } from 'date-fns';
import { ContentPlan } from '@/6-1-dashboard/types/social-media';
import { isEmployeeActive } from '@/2-1-employees/utils/employeeUtils';
import './AddContentDialog.css';

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
  editingPlan = null
}) => {
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { addContentPlan, updateContentPlan } = useSocialMediaMutations();
  const isEditMode = !!editingPlan;
  
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


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] flex flex-col p-0 overflow-hidden" style={{ zIndex: 999999 }}>
        {/* Sticky Header */}
        <DialogHeader className="flex-shrink-0 bg-background z-10 pb-4 pt-6 px-6 border-b">
          <DialogTitle>
            {isEditMode ? 'Edit Content Plan' : 'Add New Content Plan'} - {selectedDate && format(selectedDate, 'dd MMMM yyyy')}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Edit the content plan details. Fill in all required fields to save your changes.'
              : 'Create a new content plan for the selected date. Fill in all required fields to save your content plan.'}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto seamless-scroll px-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading master data...</p>
              </div>
            </div>
          ) : (
          <form onSubmit={handleSubmit} id="content-plan-form" className="space-y-4 py-4">
          {/* Post Date - Only show in edit mode, and disable if approved */}
          {isEditMode && editingPlan && (
            <div className="space-y-2">
              <Label htmlFor="post_date">Post Date {editingPlan.approved && '(Cannot change - Already approved)'}</Label>
              <Input
                id="post_date"
                type="date"
                value={formData.post_date}
                onChange={(e) => setFormData(prev => ({ ...prev, post_date: e.target.value }))}
                disabled={editingPlan.approved === true}
                className={editingPlan.approved ? 'bg-muted' : ''}
              />
              {editingPlan.approved && (
                <p className="text-xs text-muted-foreground">
                  Post date cannot be changed for approved content plans
                </p>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter content title"
              required
            />
          </div>

          {/* Brief */}
          <div className="space-y-2">
            <Label htmlFor="brief">Brief</Label>
            <Textarea
              id="brief"
              value={formData.brief}
              onChange={(e) => setFormData(prev => ({ ...prev, brief: e.target.value }))}
              placeholder="Enter content brief/description"
              rows={3}
            />
          </div>

          {/* Service */}
          <div className="space-y-2">
            <Label htmlFor="service">Service</Label>
            <Select
              value={formData.service_id}
              onValueChange={(value) => {
                setFormData(prev => ({ 
                  ...prev, 
                  service_id: value,
                  sub_service_id: '' // Reset sub service when service changes
                }));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent 
                className="max-h-[200px] overflow-y-auto" 
                position="popper" 
                sideOffset={4}
                style={{ zIndex: 999999 }}
              >
                {services.length > 0 ? (
                  services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-services" disabled>
                    No services available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

           {/* Sub Service */}
           <div className="space-y-2">
             <Label htmlFor="subService">Sub Service</Label>
             <Select
               value={formData.sub_service_id}
               onValueChange={(value) => {
                 setFormData(prev => ({ ...prev, sub_service_id: value }));
               }}
               disabled={!formData.service_id}
             >
               <SelectTrigger className="w-full">
                 <SelectValue placeholder={formData.service_id ? "Select sub service" : "Please select service first"} />
               </SelectTrigger>
              <SelectContent 
                className="max-h-[200px] overflow-y-auto" 
                position="popper" 
                sideOffset={4}
                style={{ zIndex: 999999 }}
              >
                {filteredSubServices.length > 0 ? (
                  filteredSubServices.map((subService) => (
                    <SelectItem key={subService.id} value={subService.id}>
                      {subService.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-sub-services" disabled>
                    No sub services available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Content Pillar */}
          <div className="space-y-2">
            <Label htmlFor="pillar">Content Pillar</Label>
            <Select
              value={formData.content_pillar_id}
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, content_pillar_id: value }));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select content pillar" />
              </SelectTrigger>
              <SelectContent 
                className="max-h-[200px] overflow-y-auto" 
                position="popper" 
                sideOffset={4}
                style={{ zIndex: 999999 }}
              >
                {contentPillars.length > 0 ? (
                  contentPillars.map((pillar) => (
                    <SelectItem key={pillar.id} value={pillar.id}>
                      <div className="flex items-center gap-2">
                        {pillar.color && (
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: pillar.color }}
                          />
                        )}
                        {pillar.name}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-content-pillars" disabled>
                    No content pillars available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Content Type */}
          <div className="space-y-2">
            <Label htmlFor="contentType">Content Type</Label>
            <Select
              value={formData.content_type_id}
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, content_type_id: value }));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select content type" />
              </SelectTrigger>
              <SelectContent 
                className="max-h-[200px] overflow-y-auto" 
                position="popper" 
                sideOffset={4}
                style={{ zIndex: 999999 }}
              >
                {contentTypes.length > 0 ? (
                  contentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-content-types" disabled>
                    No content types available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* PIC (Editable dropdown) */}
          <div className="space-y-2">
            <Label htmlFor="pic">PIC</Label>
            <Select
              value={formData.pic_id}
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, pic_id: value }));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select PIC" />
              </SelectTrigger>
              <SelectContent 
                className="max-h-[200px] overflow-y-auto" 
                position="popper" 
                sideOffset={4}
                style={{ zIndex: 999999 }}
              >
                {employees.length > 0 ? (
                  employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-employees" disabled>
                    No employees available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          </form>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="flex-shrink-0 bg-background z-10 pt-4 pb-6 px-6 border-t">
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
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
  );
};