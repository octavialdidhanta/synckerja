
import React, { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Lightbulb, ChevronLeft, ChevronRight, PlusCircle, Trash2, Edit3, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { TrainingNotificationBanner } from './TrainingNotificationBanner';
import { useLatestTrainingPrograms } from './useLatestTrainingPrograms';
import { useCurrentUserEmployee } from './HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { Button } from '@/shared/components/ui/button';
import { ModalMotivationForm } from './ModalMotivationForm/ModalMotivationForm';
import { MotivationLikeButton } from './MotivationLikeButton';
import { useMotivations } from './ModalMotivationForm/useMotivations';
import { useToast } from '@/shared/components/ui/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useReportHomeSectionStatus } from '@/1-home/context/HomePageLoadContext';
import { Skeleton } from '@/shared/components/ui/skeleton';

export const SectionMotivation = () => {
  const { t } = useAppTranslation();
  const { programs, isLoading: programsLoading, error: programsError } = useLatestTrainingPrograms();
  const {
    data: employeeData,
    isLoading: employeeLoading,
    error: employeeError,
  } = useCurrentUserEmployee();
  const {
    motivations,
    isLoading: motivationsLoading,
    error: motivationError,
    deleteMotivation,
    updateMotivation,
  } = useMotivations();

  const motivationSectionLoading =
    programsLoading || motivationsLoading || employeeLoading;
  const motivationSectionError =
    (motivationError as Error | null | undefined) ||
    (programsError as Error | null | undefined) ||
    (employeeError as Error | null | undefined) ||
    null;
  useReportHomeSectionStatus(
    'motivation',
    motivationSectionLoading,
    motivationSectionError instanceof Error
      ? motivationSectionError
      : motivationSectionError
        ? new Error(String(motivationSectionError))
        : null,
  );
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMotivationDialogOpen, setIsMotivationDialogOpen] = useState(false);
  const [editingMotivation, setEditingMotivation] = useState<any>(null);

  // Combine motivations and training programs
  const bannerItems = [
    ...motivations.map(motivation => ({ 
      type: 'quote' as const, 
      content: `${motivation.content} - ${motivation.author_name}`,
      motivation: motivation
    })),
    ...programs.map(program => ({ type: 'training' as const, content: program }))
  ];

  const totalItems = bannerItems.length;

  // Auto-slide every 8 seconds
  useEffect(() => {
    if (isPaused || totalItems <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % totalItems);
    }, 8000);

    return () => clearInterval(interval);
  }, [totalItems, isPaused]);

  const goToPrevious = () => {
    setCurrentIndex(prev => (prev - 1 + totalItems) % totalItems);
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev + 1) % totalItems);
  };

  const handleDeleteMotivation = async (motivationId: string) => {
    try {
      await deleteMotivation(motivationId);
      toast({
        title: t('common.success', 'Success'),
        description: t('motivation.deletedSuccessfully', 'Motivation deleted successfully'),
      });
      
      // Adjust current index if needed
      if (currentIndex >= totalItems - 1 && totalItems > 1) {
        setCurrentIndex(0);
      }
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('motivation.failedToDelete', 'Failed to delete motivation'),
        variant: "destructive",
      });
    }
  };

  const handleEditMotivation = (motivation: any) => {
    setEditingMotivation(motivation);
    setIsMotivationDialogOpen(true);
  };

  const getCurrentUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  };

  const isOwner = async (motivationCreatedBy: string) => {
    const currentUserId = await getCurrentUserId();
    return currentUserId === motivationCreatedBy;
  };

  if (motivationSectionLoading) {
    // Keep placeholder visible until all motivation + training program data is ready.
    // This prevents the skeleton from disappearing while the section is still loading.
    return <Skeleton className="h-[50px] w-full rounded-lg" aria-hidden />;
  }

  if (motivationSectionError) {
    return (
      <Card className="min-h-[70px] border-destructive/40 bg-card">
        <CardContent className="flex items-center p-4">
          <p className="text-sm text-destructive">
            {motivationSectionError instanceof Error
              ? motivationSectionError.message
              : String(motivationSectionError)}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (totalItems === 0) {
    // Fallback when loading or no data
    return (
      <>
        <Card className="min-h-[80px] bg-gradient-to-r from-primary to-brand-blue-deep text-primary-foreground">
          <CardContent className="p-4 flex items-center space-x-3 h-full">
            <Lightbulb className="h-6 w-6 text-primary-foreground" />
            <div className="flex-1">
              <p className="text-xs font-medium">{t('motivation.noMotivationToday', 'No motivation today')}</p>
              <p className="text-xs text-primary-foreground/85">{t('motivation.writeFirstMotivation', 'Write your first motivation!')}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="flex h-8 flex-shrink-0 items-center gap-1 px-2 py-1 text-primary-foreground hover:bg-primary-foreground/15"
              onClick={() => setIsMotivationDialogOpen(true)}
            >
              <PlusCircle className="h-3 w-3" />
              <span className="text-xs">{t('motivation.write', 'Write')}</span>
            </Button>
          </CardContent>
        </Card>
        
        <ModalMotivationForm
          isOpen={isMotivationDialogOpen}
          onClose={() => setIsMotivationDialogOpen(false)}
          profileName={employeeData?.profile_name}
        />
      </>
    );
  }

  const currentItem = bannerItems[currentIndex];

  return (
    <>
      <div 
        className="relative group min-h-[50px]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="transition-all duration-500 ease-in-out h-full">
          {currentItem.type === 'quote' ? (
            <Card className="min-h-[80px] bg-gradient-to-r from-primary to-brand-blue-deep text-primary-foreground">
              <CardContent className="p-4 flex items-center space-x-3 h-full">
                <Lightbulb className="h-6 w-6 flex-shrink-0 text-primary-foreground" />
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium leading-relaxed text-primary-foreground">{currentItem.content}</p>
                  <p className="mt-1 text-xs text-primary-foreground/85">{t('motivation.todayMotivation', 'Today\'s motivation')}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <MotivationLikeButton motivation={currentItem.motivation} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex h-8 flex-shrink-0 items-center gap-1 px-2 py-1 text-primary-foreground hover:bg-primary-foreground/15"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem onClick={() => setIsMotivationDialogOpen(true)}>
                      <PlusCircle className="h-3 w-3 mr-2" />
                      {t('motivation.write', 'Write')}
                    </DropdownMenuItem>
                    {currentItem.motivation && (
                      <>
                        <DropdownMenuItem 
                          onClick={async () => {
                            if (await isOwner(currentItem.motivation.created_by)) {
                              handleEditMotivation(currentItem.motivation);
                            }
                          }}
                        >
                          <Edit3 className="h-3 w-3 mr-2" />
                          {t('common.edit', 'Edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={async () => {
                            if (await isOwner(currentItem.motivation.created_by)) {
                              handleDeleteMotivation(currentItem.motivation.id);
                            }
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          {t('common.delete', 'Delete')}
                        </DropdownMenuItem>
                      </>
                    )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ) : (
            <TrainingNotificationBanner program={currentItem.content} />
          )}
        </div>

        {/* Navigation buttons - positioned at bottom corners */}
        {totalItems > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 bottom-2 h-7 w-7 bg-black/20 hover:bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={goToPrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 bottom-2 h-7 w-7 bg-black/20 hover:bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={goToNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Dots indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1">
              {bannerItems.map((_, index) => (
                <button
                  key={index}
                  className={`h-1.5 w-1.5 rounded-full transition-all ${
                    index === currentIndex 
                      ? 'bg-primary-foreground' 
                      : 'bg-primary-foreground/50 hover:bg-primary-foreground/70'
                  }`}
                  onClick={() => setCurrentIndex(index)}
                />
              ))}
            </div>
          </>
        )}
      </div>
      
      <ModalMotivationForm
        isOpen={isMotivationDialogOpen}
        onClose={() => {
          setIsMotivationDialogOpen(false);
          setEditingMotivation(null);
        }}
        profileName={employeeData?.profile_name}
        editingMotivation={editingMotivation}
      />
    </>
  );
};
