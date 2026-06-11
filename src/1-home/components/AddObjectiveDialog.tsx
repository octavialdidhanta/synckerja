import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Plus, CalendarDays, Calendar } from 'lucide-react';
import { useOkrCycles } from '@/shared/hooks/useOkrCycles';
import { useCreateObjective } from './HomeOKRDashboard/component/ObjectivesTabImport/useObjectives';
import { useUpdateCompanyObjective } from './HomeOKRDashboard/hooks/useUpdateCompanyObjective';
import { useUnifiedProfile } from '@/shared/hooks/useUnifiedProfile';
import { useCreateOkrCycle } from './HomeOKRDashboard/hooks/useCreateOkrCycle';
import { useToast } from '@/shared/components/ui/use-toast';
import { supabase } from '@/shared/lib/supabaseClient';
interface AddObjectiveDialogProps {
  type: 'company' | 'department' | 'individual';
  buttonClassName?: string;
  onObjectiveAdded?: () => void;
  editObjective?: any; // Add edit mode support
  open?: boolean; // Add open prop for controlled mode
  onOpenChange?: (open: boolean) => void; // Add onOpenChange for controlled mode
  /** Prefer prop from parent view when profile cache is stale. */
  organizationId?: string;
  /** Pre-select OKR cycle (e.g. from year/quarter filter on company tab). */
  defaultCycleId?: string;
}
export const AddObjectiveDialog = ({
  type,
  buttonClassName = '',
  onObjectiveAdded,
  editObjective,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  organizationId: organizationIdProp,
  defaultCycleId,
}: AddObjectiveDialogProps) => {
  const { data: unifiedData } = useUnifiedProfile();
  const profile = unifiedData?.profile;
  const organizationId = organizationIdProp ?? profile?.active_organization_id;
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [isGeneratingPeriods, setIsGeneratingPeriods] = React.useState(false);
  const [formData, setFormData] = React.useState({
    cycle_id: '',
    title: '',
    why_important: '',
    status: 'draft' as 'draft' | 'active' | 'completed' | 'cancelled',
    department_id: ''
  });

  // Use controlled open state if provided, otherwise use internal state
  const isOpen = controlledOpen !== undefined ? controlledOpen : showCreateDialog;
  const setIsOpen = controlledOnOpenChange || setShowCreateDialog;

  // Initialize form data when editObjective changes
  React.useEffect(() => {
    if (editObjective && isOpen) {
      setFormData({
        cycle_id: editObjective.cycle_id || '',
        title: editObjective.title || '',
        why_important: editObjective.why_important || '',
        status: editObjective.status || 'draft',
        department_id: editObjective.department_id || ''
      });
    } else if (!editObjective && isOpen) {
      // Reset form for new objective
      setFormData({
        cycle_id: defaultCycleId || '',
        title: '',
        why_important: '',
        status: 'draft',
        department_id: ''
      });
    }
  }, [editObjective, isOpen, defaultCycleId]);

  // Hooks
  const {
    data: cycles = []
  } = useOkrCycles(organizationId);
  const createObjective = useCreateObjective();
  const updateCompanyObjective = useUpdateCompanyObjective();
  const createOkrCycle = useCreateOkrCycle();
  const level = type;
  const departments: any[] = []; // TODO: Add departments hook

  const triggerButtonClass =
    'bg-primary text-primary-foreground hover:bg-primary/90';
  const handleGeneratePeriods = async () => {
    if (!organizationId || !profile?.user_id) {
      toast({
        title: 'Error',
        description: 'Organization ID or user ID not found',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingPeriods(true);
    
    try {
      const currentYear = new Date().getFullYear();
      
      // Check if cycles already exist for current year
      const existingCycles = cycles.filter(cycle => cycle.year === currentYear);
      if (existingCycles.length > 0) {
        toast({
          title: 'Info',
          description: `OKR periods for ${currentYear} already exist`,
        });
        setIsGeneratingPeriods(false);
        return;
      }

      const periodsToGenerate = [];

      // Generate quarterly periods for current year
      const quarters = ['q1', 'q2', 'q3', 'q4'] as const;
      
      for (const quarter of quarters) {
        const quarterNum = parseInt(quarter.substring(1));
        const startMonth = (quarterNum - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
        const endMonth = startMonth + 2; // Q1=2, Q2=5, Q3=8, Q4=11
        
        const startDate = new Date(currentYear, startMonth, 1);
        const endDate = new Date(currentYear, endMonth + 1, 0); // Last day of end month
        
        periodsToGenerate.push({
          organization_id: organizationId,
          name: `${currentYear} ${quarter.toUpperCase()}`,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          year: currentYear,
          quarter: quarter,
          period_type: 'quarterly' as const,
          is_active: quarter === 'q4', // Make Q4 active by default
          created_by: profile.user_id
        });
      }

      // Generate yearly period
      periodsToGenerate.push({
        organization_id: organizationId,
        name: `${currentYear} Full Year`,
        start_date: `${currentYear}-01-01`,
        end_date: `${currentYear}-12-31`,
        year: currentYear,
        quarter: null,
        period_type: 'yearly' as const,
        is_active: false,
        created_by: profile.user_id
      });

      // Create all periods
      for (const periodData of periodsToGenerate) {
        await createOkrCycle.mutateAsync(periodData);
      }

      toast({
        title: 'Success',
        description: `Generated ${periodsToGenerate.length} OKR periods for ${currentYear}`,
      });

    } catch (error) {
      console.error('Error generating periods:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate OKR periods',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPeriods(false);
    }
  };
  const handleCustomRange = () => {
    // TODO: Implement custom range logic
    console.log('Custom range clicked');
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For edit mode, we don't need cycle_id validation since the objective already exists
    if (editObjective) {
      if (!formData.title || !formData.why_important || !organizationId || !profile?.user_id) {
        return;
      }
    } else {
      if (!formData.cycle_id || !formData.title || !formData.why_important || !organizationId || !profile?.user_id) {
        return;
      }
    }
    
    try {
      if (editObjective) {
        console.log('🔄 Edit mode - objective data:', editObjective);
        console.log('🔄 Edit mode - form data:', formData);
        
        // Handle edit mode for company objectives
        if (type === 'company') {
          const updateData = {
            id: editObjective.id,
            updates: {
              title: formData.title,
              why_important: formData.why_important,
              status: formData.status,
              weight: 100
            }
          };
          
          console.log('🔄 Updating company objective with data:', updateData);
          await updateCompanyObjective.mutateAsync(updateData);
        } else {
          // For other types, show message that edit is not yet implemented
          toast({
            title: 'Info',
            description: `Edit functionality for ${type} objectives is not yet implemented`,
          });
        }
        setIsOpen(false);
        onObjectiveAdded?.();
      } else {
        const companyObjective = await createObjective.mutateAsync({
          organization_id: organizationId,
          cycle_id: formData.cycle_id,
          title: formData.title,
          why_important: formData.why_important,
          level: type,
          owner_id: profile.user_id,
          status: formData.status,
          weight: 100,
          created_by: profile.user_id,
          department_id: formData.department_id || undefined
        });

        // Create corresponding key result for company objectives
        if (type === 'company' && companyObjective && (companyObjective as any).id) {
          try {
            const { data: keyResultData, error: keyResultError } = await supabase
              .from('key_results')
              .insert({
                company_objective_id: (companyObjective as any).id,
                title: formData.title,
                metric_type: 'percentage',
                target_value: 100,
                unit: '%',
                current_value: 0,
                progress_percentage: 0,
                weight: 100,
              })
              .select()
              .single();

            if (keyResultError) {
              console.error('Error creating key result for company objective:', keyResultError);
              toast({
                title: 'Warning',
                description: 'Company objective created but key result creation failed. Please check the logs.',
                variant: 'destructive',
              });
            } else {
              console.log('✅ Key result created successfully for company objective:', keyResultData);
            }
          } catch (keyResultError) {
            console.error('Error creating key result for company objective:', keyResultError);
            toast({
              title: 'Warning',
              description: 'Company objective created but key result creation failed. Please check the logs.',
              variant: 'destructive',
            });
          }
        }

        // Reset form and close dialog
        setIsOpen(false);
        onObjectiveAdded?.();
      }
    } catch (error) {
      console.error('Error with objective:', error);
      toast({
        title: 'Error',
        description: editObjective ? 'Failed to update objective' : 'Failed to create objective',
        variant: 'destructive',
      });
    }
  };
  const isControlled = controlledOpen !== undefined;

  return <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!isControlled && <DialogTrigger asChild>
        <Button className={`${triggerButtonClass} ${buttonClassName}`}>
          <Plus className="h-4 w-4 mr-2" />
          Add Objective
        </Button>
      </DialogTrigger>}
      
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editObjective ? 'Edit' : 'Create'} Objective for {level.charAt(0).toUpperCase() + level.slice(1)}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Tetapkan target OKR baru atau ubah objective yang sudah ada untuk level organisasi yang dipilih.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cycle_id">
              OKR Cycle {!editObjective && <span className="text-destructive">*</span>}
            </Label>
            <Select 
              value={formData.cycle_id} 
              onValueChange={value => setFormData(prev => ({
                ...prev,
                cycle_id: value
              }))}
              disabled={editObjective} // Disable cycle selection in edit mode
            >
              <SelectTrigger>
                <SelectValue placeholder="Select OKR cycle" />
              </SelectTrigger>
              <SelectContent>
                {/* Group cycles by year and period type */}
                {Object.entries(cycles.reduce((acc: any, cycle: any) => {
                if (!acc[cycle.year]) acc[cycle.year] = {
                  yearly: null,
                  quarterly: []
                };
                if (cycle.period_type === 'yearly') {
                  acc[cycle.year].yearly = cycle;
                } else if (cycle.period_type === 'quarterly') {
                  acc[cycle.year].quarterly.push(cycle);
                }
                return acc;
              }, {} as Record<number, {
                yearly: any;
                quarterly: any[];
              }>)).map(([year, yearData]: [string, any]) => <div key={year}>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                      {year}
                    </div>
                    
                    {/* Yearly option */}
                    {yearData.yearly && <SelectItem key={yearData.yearly.id} value={yearData.yearly.id} className="pl-6">
                        📅 {year} (Full Year)
                      </SelectItem>}
                    
                    {/* Quarterly options */}
                    {yearData.quarterly.sort((a: any, b: any) => {
                  const quarterOrder = {
                    q1: 1,
                    q2: 2,
                    q3: 3,
                    q4: 4
                  };
                  return (quarterOrder[a.quarter as keyof typeof quarterOrder] || 0) - (quarterOrder[b.quarter as keyof typeof quarterOrder] || 0);
                }).map((cycle: any) => <SelectItem key={cycle.id} value={cycle.id} className="pl-8">
                          📊 {cycle.name}
                        </SelectItem>)}
                  </div>)}
                
                {/* Generate Periods and Custom Range options at bottom */}
                <div className="border-t mt-2 pt-2">
                  <div
                    className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm text-primary hover:bg-accent hover:text-primary"
                    onClick={e => {
                      e.preventDefault();
                      handleGeneratePeriods();
                    }}
                  >
                    <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-primary" />
                    {isGeneratingPeriods ? "Generating..." : "Generate Periods"}
                  </div>
                  <div
                    className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm text-primary hover:bg-accent hover:text-primary"
                    onClick={e => {
                      e.preventDefault();
                      handleCustomRange();
                    }}
                  >
                    <Calendar className="mr-2 h-4 w-4 shrink-0 text-primary" />
                    Custom Range
                  </div>
                </div>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <Select value={level} disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value: 'draft' | 'active' | 'completed' | 'cancelled') => setFormData(prev => ({
              ...prev,
              status: value
            }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">
              Objective Title <span className="text-red-500">*</span>
            </Label>
            <Input id="title" placeholder="Enter objective title" value={formData.title} onChange={e => setFormData(prev => ({
            ...prev,
            title: e.target.value
          }))} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="why_important">
              Why is this important? <span className="text-destructive">*</span>
            </Label>
            <Textarea id="why_important" placeholder="Explain why this objective is important for the organization" value={formData.why_important} onChange={e => setFormData(prev => ({
            ...prev,
            why_important: e.target.value
          }))} required rows={3} />
          </div>


          {level === 'department' && <div className="space-y-2">
              <Label htmlFor="department_id">Department</Label>
              <Select value={formData.department_id} onValueChange={value => setFormData(prev => ({
            ...prev,
            department_id: value
          }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(dept => <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createObjective.isPending || updateCompanyObjective.isPending}>
              {createObjective.isPending || updateCompanyObjective.isPending ? 
                (editObjective ? 'Updating...' : 'Creating...') : 
                (editObjective ? 'Update Objective' : 'Create Objective')
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>;
};
