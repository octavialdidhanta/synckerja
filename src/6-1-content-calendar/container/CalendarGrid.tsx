import React, { useMemo } from 'react';
import { Plus, ExternalLink, Play } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { isSameDay } from 'date-fns';
import { useBatchSocialMediaLinks } from '../hooks/useBatchSocialMediaLinks';
import { getCalendarPlanCardTone, type CalendarCardTone } from '../utils/calendarPlanCardTone';

const indonesianDays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

interface CalendarGridProps {
  calendarDays: Array<{ date: Date; isCurrentMonth: boolean }>;
  getDayInfo: (date: Date) => any;
  onDayClick: (date: Date, dayInfo: any) => void;
  onPlanClick?: (date: Date, plan: any) => void; // Optional: handler for clicking individual plan card
  /** Production Need Review (grey) & Production Revision (red): open Google Drive preview modal */
  onOpenPreview?: (plan: any) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  calendarDays,
  getDayInfo,
  onDayClick,
  onPlanClick,
  onOpenPreview
}) => {
  const { t } = useAppTranslation();
  // Extract plan IDs for green cards (done = true) to fetch links
  // Extract directly from calendarDays to avoid dependency on getDayInfo function
  const planIdsForLinks = useMemo(() => {
    const ids: string[] = [];
    calendarDays.forEach(({ date }) => {
      const dayInfo = getDayInfo(date);
      dayInfo.plans?.forEach((plan: any) => {
        // Only green cards (done = true) need social_media_links
        if (plan?.approved && plan?.production_approved && plan?.done && plan?.id) {
          ids.push(plan.id);
        }
      });
    });
    return [...new Set(ids)]; // Remove duplicates
  }, [calendarDays, getDayInfo]);

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

  // Helper function to get PIC name based on status
  const getPicName = (plan: any): string => {
    const approved = plan?.approved === true;
    const productionApproved = plan?.production_approved === true;
    const done = plan?.done === true;

    // Case 1: approved=false, production_approved=false, done=false → pic_id
    if (!approved && !productionApproved && !done) {
      return plan?.pic?.full_name || 'Unassigned';
    }

    // Case 2: approved=true, production_approved=false, done=false → pic_production_id
    if (approved && !productionApproved && !done) {
      return plan?.pic_production?.full_name || 'Unassigned';
    }

    // Case 3: approved=true, production_approved=true, done=false → pic_production_id
    if (approved && productionApproved && !done) {
      return plan?.pic_production?.full_name || 'Unassigned';
    }

    // Case 4: approved=true, production_approved=true, done=true → post_link_created_by
    if (approved && productionApproved && done) {
      return plan?.post_link_creator?.full_name || 'Unassigned';
    }

    // Fallback to pic_id
    return plan?.pic?.full_name || 'Unassigned';
  };

  const cardShellClass = (tone: CalendarCardTone) => {
    switch (tone) {
      case 'green':
        return 'bg-green-500 text-white shadow-lg shadow-green-300/50 ring-1 ring-green-300/20';
      case 'yellow':
        return 'bg-amber-400 text-gray-900';
      case 'orange':
        return 'bg-orange-500 text-white';
      case 'red':
        return 'bg-red-500 text-white shadow-lg shadow-red-300/50 ring-1 ring-red-300/20';
      case 'prod-need-review':
        return 'bg-gray-500 dark:bg-slate-600 text-white shadow-md ring-1 ring-gray-400/50 dark:ring-slate-500/50';
      case 'prod-request-revision':
        return 'bg-red-800 dark:bg-red-950 text-white shadow-md ring-1 ring-red-700/40 dark:ring-red-800/50';
      default:
        return 'bg-blue-50 border border-blue-200 text-blue-900';
    }
  };

  const cardMetaLineClass = (tone: CalendarCardTone) => {
    switch (tone) {
      case 'green':
        return 'text-emerald-50';
      case 'yellow':
        return 'text-gray-800';
      case 'orange':
        return 'text-orange-50';
      case 'red':
        return 'text-red-50';
      case 'prod-need-review':
        return 'text-gray-100 dark:text-slate-100';
      case 'prod-request-revision':
        return 'text-red-100 dark:text-red-50';
      default:
        return 'text-blue-700';
    }
  };

  const cardTitleClass = (tone: CalendarCardTone) => {
    switch (tone) {
      case 'green':
        return 'text-white';
      case 'yellow':
        return 'text-gray-900';
      case 'orange':
      case 'red':
      case 'prod-need-review':
      case 'prod-request-revision':
        return 'text-white';
      default:
        return 'text-blue-900';
    }
  };

  const cardSubMetaClass = (tone: CalendarCardTone) => {
    switch (tone) {
      case 'green':
        return 'text-emerald-100';
      case 'yellow':
        return 'text-gray-700';
      case 'orange':
        return 'text-orange-100';
      case 'red':
        return 'text-red-100';
      case 'prod-need-review':
        return 'text-gray-200 dark:text-slate-200';
      case 'prod-request-revision':
        return 'text-red-100 dark:text-red-200';
      default:
        return 'text-blue-600';
    }
  };

  const revisionBadgeClass = () => 'inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none bg-white/90 text-slate-900 ring-1 ring-white/40 backdrop-blur-[1px]';

  /** Kolom header selaras dengan grid: index 0 = Min (Minggu) … sama dengan Date#getDay(). */
  const todayWeekdayIndex = new Date().getDay();

  return (
    <div className="relative">
      {/* Days of week header - Fixed positioning */}
      <div className="-mt-4 mb-2 grid grid-cols-7 gap-1 py-2 sticky -top-4 z-20 bg-white dark:bg-slate-950">
        {indonesianDays.map((day, columnIndex) => {
          const isTodayWeekdayColumn = todayWeekdayIndex === columnIndex;
          return (
            <div
              key={day}
              className={cn(
                'rounded-md p-2 text-center text-sm font-medium',
                isTodayWeekdayColumn
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              )}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Calendar days with padding top to account for sticky header */}
      <div className="grid grid-cols-7 gap-1 pt-2">
        {calendarDays.map(({ date, isCurrentMonth }, index) => {
          const dayInfo = getDayInfo(date);
          const isToday = isSameDay(date, new Date());
          
          return (
            <div
              key={index}
              onClick={() => onDayClick(date, dayInfo)}
              className={`
                aspect-square p-2 border border-slate-200 dark:border-slate-700 flex flex-col text-xs relative cursor-pointer transition-colors overflow-hidden
                ${!isCurrentMonth ? 'text-slate-400 bg-slate-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-800'}
                ${isToday ? 'ring-2 ring-primary' : ''}
                hover:shadow-md hover:scale-105 transition-all duration-200
              `}
            >
              {/* Content count badge - shown when more than 1 content */}
              {dayInfo.count > 1 && (
                <div className="absolute top-1.5 right-0.5 z-10 bg-red-600 text-white text-[11px] font-bold rounded-md min-w-[20px] h-[20px] flex items-center justify-center px-1.5 shadow-lg ring-2 ring-red-400/30 transform hover:scale-110 transition-transform">
                  <span className="drop-shadow-sm">{dayInfo.count}</span>
                </div>
              )}
              
              <div className="font-medium text-sm mb-1">
                {date.getDate()}
              </div>
              
              {dayInfo.count > 0 ? (
                <div className="flex-1 min-h-0 space-y-1 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain">
                  {dayInfo.plans.map((plan: any, planIndex: number) => {
                    // Determine individual plan color based on status
                    const approved = plan?.approved === true;
                    const productionApproved = plan?.production_approved === true;
                    const done = plan?.done === true;
                    const onTimeStatus = plan?.on_time_status;
                    
                    // Check if on_time_status is not "Ontime" and not NULL/Empty
                    const hasLateStatus = onTimeStatus && 
                                         typeof onTimeStatus === 'string' &&
                                         onTimeStatus.trim() !== '' && 
                                         onTimeStatus !== 'Ontime' &&
                                         onTimeStatus.toLowerCase().includes('late');
                    
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

                    const cardTone = getCalendarPlanCardTone(plan);
                    
                    // Get links for green cards (with null safety)
                    const planLinks = (plan?.id && linksByPlanId[plan.id]) || [];
                    
                    // Check yellow card for google_drive_link (with validation)
                    const hasGoogleDriveLink = planStatus === 'yellow' && 
                                             productionApproved && 
                                             plan?.google_drive_link &&
                                             isValidUrl(plan.google_drive_link);
                    
                    return (
                      <div 
                        key={planIndex} 
                        onClick={(e) => {
                          // Stop propagation to prevent day click handler
                          e.stopPropagation();
                          // If onPlanClick is provided, call it to open only this specific plan
                          if (onPlanClick) {
                            onPlanClick(date, plan);
                          }
                        }}
                        className={`text-xs space-y-0.5 p-1.5 rounded shadow-sm cursor-pointer hover:opacity-90 hover:shadow-md transition-all ${cardShellClass(cardTone)}`}
                      >
                        {/* Late Status Text - Show if plan is green with late status */}
                        {planStatus === 'green' && hasLateStatus && onTimeStatus && (
                          <div className="text-[10px] font-bold text-white mb-0.5 bg-red-500 px-1 py-0.5 rounded shadow-sm">
                            {onTimeStatus}
                          </div>
                        )}
                        
                        {/* Service - Sub Service - Pillar */}
                        <div className={`truncate text-[10px] ${cardMetaLineClass(cardTone)}`}>
                          {[
                            plan?.service?.name,
                            plan?.sub_service?.name,
                            plan?.content_pillar?.name
                          ].filter(Boolean).join(' - ') || 'No Service'}
                        </div>
                        
                        {/* Title */}
                        <div className={`font-semibold truncate ${cardTitleClass(cardTone)}`}>
                          {plan?.title || 'Untitled'}
                        </div>
                        
                        {/* PIC, Content Type, Pillar */}
                        <div className={`truncate text-[10px] ${cardSubMetaClass(cardTone)}`}>
                          {[
                            getPicName(plan),
                            plan?.content_type?.name,
                            plan?.content_pillar?.name
                          ].filter(Boolean).join(' • ')}
                        </div>

                        {(cardTone === 'prod-need-review' || cardTone === 'prod-request-revision') &&
                          onOpenPreview && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenPreview(plan);
                              }}
                              className={`mt-1 flex w-full items-center justify-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold text-white ring-1 hover:opacity-95 ${
                                cardTone === 'prod-request-revision'
                                  ? 'bg-white/20 ring-white/25 hover:bg-white/30'
                                  : 'bg-white/25 ring-white/30 hover:bg-white/35'
                              }`}
                            >
                              <Play className="h-2.5 w-2.5 shrink-0 fill-current" aria-hidden />
                              {t('contentCalendar.grid.preview', 'Preview')}
                            </button>
                            {Number(plan?.production_revision_count || 0) > 0 && (
                              <div className="mt-1">
                                <span
                                  className={revisionBadgeClass()}
                                  aria-label={`Revision ${Number(plan?.production_revision_count || 0)}`}
                                >
                                  Rev {Number(plan?.production_revision_count || 0)}
                                </span>
                              </div>
                            )}
                          </>
                        )}

                        {/* Fallback: non-preview cards tetap tampilkan Rev badge jika ada revision */}
                        {!(cardTone === 'prod-need-review' || cardTone === 'prod-request-revision') &&
                          Number(plan?.production_revision_count || 0) > 0 && (
                          <div className="mt-1">
                            <span
                              className={revisionBadgeClass()}
                              aria-label={`Revision ${Number(plan?.production_revision_count || 0)}`}
                            >
                              Rev {Number(plan?.production_revision_count || 0)}
                            </span>
                          </div>
                        )}
                        
                        {/* NEW: Green cards - Display all social media links */}
                        {planStatus === 'green' && planLinks.length > 0 && (
                          <div className="mt-1.5 pt-1.5 border-t border-white/20">
                            <div className="text-[9px] font-semibold text-emerald-50 mb-0.5">
                              Links:
                            </div>
                            <div className="space-y-0.5">
                              {planLinks
                                .filter(link => link?.url && isValidUrl(link.url)) // Filter invalid URLs
                                .slice(0, 3) // Limit to 3 links to prevent overflow
                                .map((link) => (
                                <a
                                  key={link.id}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    e.stopPropagation(); // Only stop on link click, not card click
                                  }}
                                  className="flex items-center gap-1 text-[9px] text-emerald-100 hover:text-white hover:underline truncate"
                                  title={`${link.platform || 'Link'}: ${link.url}`}
                                >
                                  <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                                  <span className="truncate">
                                    {link.platform || 'Link'}: {link.url.length > 25 ? link.url.substring(0, 25) + '...' : link.url}
                                  </span>
                                </a>
                              ))}
                              {planLinks.filter(link => link?.url && isValidUrl(link.url)).length > 3 && (
                                <div className="text-[8px] text-emerald-200">
                                  +{planLinks.filter(link => link?.url && isValidUrl(link.url)).length - 3} more
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* NEW: Yellow cards - Display google_drive_link */}
                        {hasGoogleDriveLink && (
                          <div
                            className={`mt-1.5 pt-1.5 border-t ${
                              cardTone === 'yellow'
                                ? 'border-amber-300/20'
                                : 'border-white/25'
                            }`}
                          >
                            <div
                              className={`text-[9px] font-semibold mb-0.5 ${
                                cardTone === 'yellow' ? 'text-gray-800' : 'text-white/90'
                              }`}
                            >
                              Preview:
                            </div>
                            <a
                              href={plan.google_drive_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.stopPropagation(); // Only stop on link click, not card click
                              }}
                              className={`flex items-center gap-1 text-[9px] truncate hover:underline ${
                                cardTone === 'yellow'
                                  ? 'text-gray-700 hover:text-gray-900'
                                  : 'text-white/85 hover:text-white'
                              }`}
                              title={plan.google_drive_link}
                            >
                              <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                              <span className="truncate">
                                {plan.google_drive_link.length > 30 ? plan.google_drive_link.substring(0, 30) + '...' : plan.google_drive_link}
                              </span>
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : isCurrentMonth ? (
                <div className="flex-1 flex items-center justify-center opacity-20 hover:opacity-60 transition-opacity">
                  <Plus className="h-4 w-4" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
