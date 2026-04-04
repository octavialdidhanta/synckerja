import React, { useMemo } from 'react';
import { Plus, Calendar as CalendarIcon, ExternalLink, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useBatchSocialMediaLinks } from '../hooks/useBatchSocialMediaLinks';
import { ContentPlanBriefDisplay } from './ContentPlanBriefDisplay';

interface DayDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  plansByDate: { [key: string]: any[] };
  onAddContent: (date: Date) => void;
  onEditContent?: (plan: any) => void; // Handler for edit action
  selectedPlan?: any | null; // Optional: if provided, show only this plan
}

export const DayDetailsDialog: React.FC<DayDetailsDialogProps> = ({
  open,
  onOpenChange,
  selectedDate,
  plansByDate,
  onAddContent,
  onEditContent,
  selectedPlan = null
}) => {
  const selectedPlanId = selectedPlan?.id as string | undefined;

  const latestSelectedPlan = useMemo(() => {
    if (!selectedPlanId) return null;
    if (!selectedDate) return selectedPlan;
    const dayKey = format(selectedDate, 'yyyy-MM-dd');
    const dayPlans = plansByDate[dayKey] || [];
    return dayPlans.find((p: any) => p?.id === selectedPlanId) ?? selectedPlan;
  }, [plansByDate, selectedDate, selectedPlan, selectedPlanId]);

  // Extract plan IDs for green cards (done = true) to fetch links
  const planIdsForLinks = useMemo(() => {
    const ids: string[] = [];
    
    // Get plans to show
    const plansToShow = latestSelectedPlan 
      ? [latestSelectedPlan]
      : selectedDate 
        ? plansByDate[format(selectedDate, 'yyyy-MM-dd')] || []
        : [];
    
    plansToShow.forEach((plan: any) => {
      // Only green cards (done = true) need social_media_links
      if (plan?.approved && plan?.production_approved && plan?.done && plan?.id) {
        ids.push(plan.id);
      }
    });
    
    return [...new Set(ids)]; // Remove duplicates
  }, [selectedDate, plansByDate, selectedPlan]);

  // Batch fetch links for green cards
  const { data: linksByPlanId = {} } = useBatchSocialMediaLinks(planIdsForLinks);

  // Helper function to validate URL
  const isValidUrl = (url: string | null | undefined): boolean => {
    if (!url || typeof url !== 'string') return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] flex min-h-0 flex-col overflow-hidden">
        <DialogHeader className="sticky top-0 z-10 border-b bg-background pb-4 pr-14 sm:pr-16">
          <DialogTitle>
            Content Plans - {selectedDate && format(selectedDate, 'dd MMMM yyyy', { locale: id })}
          </DialogTitle>
          
          {/* Sticky Add Content Button */}
          {selectedDate && (
            <div className="flex justify-between items-center pt-2">
              <h4 className="font-medium">
                {selectedPlan ? '1 Content Plan' : `${plansByDate[format(selectedDate, 'yyyy-MM-dd')]?.length || 0} Content Plans`}
              </h4>
              <Button 
                onClick={() => onAddContent(selectedDate)}
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Content
              </Button>
            </div>
          )}
        </DialogHeader>
        
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 space-y-4 overflow-y-auto overflow-x-hidden pt-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {selectedDate && (
            <>                
              {(() => {
                // If selectedPlan is provided, show only that plan, otherwise show all plans for the day
                const plansToShow = latestSelectedPlan 
                  ? [latestSelectedPlan]
                  : plansByDate[format(selectedDate, 'yyyy-MM-dd')] || [];
                
                return plansToShow.length > 0 ? (
                  <div className="space-y-3">
                    {plansToShow.map((plan) => {
                      // Determine plan status
                      const approved = plan?.approved === true;
                      const productionApproved = plan?.production_approved === true;
                      const done = plan?.done === true;
                      
                      let planStatus = 'blue';
                      if (!approved && !productionApproved && !done) {
                        planStatus = 'red';
                      } else if (approved && !productionApproved && !done) {
                        planStatus = 'orange';
                      } else if (approved && productionApproved && !done) {
                        planStatus = 'yellow';
                      } else if (approved && productionApproved && done) {
                        planStatus = 'green';
                      }
                      
                      // Get links for green cards (with null safety)
                      const planLinks = (plan?.id && linksByPlanId[plan.id]) || [];
                      
                      // Check yellow card for google_drive_link (with validation)
                      const hasGoogleDriveLink = planStatus === 'yellow' && 
                                               productionApproved && 
                                               plan?.google_drive_link &&
                                               isValidUrl(plan.google_drive_link);
                      
                      return (
                        <Card key={plan.id} className="p-3">
                          <div className="space-y-2">
                            {/* Header with Edit button */}
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                {/* Service - Sub Service - Pillar */}
                                <div className="text-sm text-muted-foreground">
                                  {[
                                    plan?.service?.name,
                                    plan?.sub_service?.name,
                                    plan?.content_pillar?.name
                                  ].filter(Boolean).join(' - ') || 'No Service'}
                                </div>
                                
                                {/* Title */}
                                <h5 className="font-medium text-lg">{plan?.title || 'Untitled Content'}</h5>
                              </div>
                              {/* Edit Button */}
                              {onEditContent && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onEditContent(plan)}
                                  className="h-8 w-8 p-0"
                                  title="Edit content plan"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            
                            {/* PIC */}
                            <div className="text-sm text-muted-foreground">
                              <strong>PIC:</strong> {plan?.pic?.full_name || 'Unassigned'}
                            </div>
                            
                            {/* Brief / script: markdown + markdown table → same table UI as brief modal */}
                            {plan?.id && <ContentPlanBriefDisplay planId={plan.id} brief={plan?.brief} />}
                            
                            {/* NEW: Green cards - Display all social media links */}
                            {planStatus === 'green' && planLinks.length > 0 && (
                              <div className="mt-2 pt-2 border-t">
                                <div className="text-sm font-semibold mb-2">
                                  Published Links:
                                </div>
                                <div className="space-y-1.5">
                                  {planLinks
                                    .filter(link => link?.url && isValidUrl(link.url)) // Filter invalid URLs
                                    .map((link) => (
                                    <a
                                      key={link.id}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                      title={`${link.platform || 'Link'}: ${link.url}`}
                                    >
                                      <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                      <span className="truncate">
                                        <strong>{link.platform || 'Link'}:</strong> {link.url}
                                      </span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* NEW: Yellow cards - Display google_drive_link */}
                            {hasGoogleDriveLink && (
                              <div className="mt-2 pt-2 border-t">
                                <div className="text-sm font-semibold mb-2">
                                  Preview Link:
                                </div>
                                <a
                                  href={plan.google_drive_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                  title={plan.google_drive_link}
                                >
                                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                  <span className="truncate">
                                    {plan.google_drive_link}
                                  </span>
                                </a>
                              </div>
                            )}
                            
                            <div className="flex justify-between items-center">
                              <div className="flex gap-2">
                                {plan?.content_type?.name && (
                                  <Badge variant="secondary" className="text-xs">
                                    {plan.content_type.name}
                                  </Badge>
                                )}
                                {plan?.content_pillar?.name && (
                                  <Badge variant="outline" className="text-xs">
                                    {plan.content_pillar.name}
                                  </Badge>
                                )}
                              </div>
                              <Badge 
                                variant={plan?.approved || plan?.done ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {plan?.approved || plan?.done ? 'Completed' : 'In Progress'}
                              </Badge>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No content plans for this day</p>
                    <p className="text-sm">Click "Add Content" to create a new plan</p>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
