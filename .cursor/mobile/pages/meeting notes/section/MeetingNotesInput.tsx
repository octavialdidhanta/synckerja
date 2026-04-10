import { useState, KeyboardEvent } from 'react';
import { User, Plus, ChevronDown, CircleDot } from 'lucide-react';
import { Button } from '@/features/ui/button';
import { Textarea } from '@/features/ui/textarea';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from '@/mobile/components/ui/drawer';
import { useMeetingNotes } from '@/features/8-1-meeting-notes/MeetingNotesContext';
import { useAvailableEmployees } from '@/features/share/hooks/useAvailableEmployees';
import { useToast } from '@/features/1-login/hooks/use-toast';
import { logger } from '@/config/logger';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'Not Started', labelKey: 'meetingNotes.filters.notStarted' as const },
  { value: 'On Going', labelKey: 'meetingNotes.filters.onGoing' as const },
  { value: 'Completed', labelKey: 'meetingNotes.filters.completed' as const },
  { value: 'Rejected', labelKey: 'meetingNotes.filters.rejected' as const },
  { value: 'Presented', labelKey: 'meetingNotes.filters.presented' as const },
];

const MeetingNotesInput = () => {
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false);
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  const [formData, setFormData] = useState({
    discussion_point: '',
    request_by: '',
    status: 'Not Started'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addMeetingPoint } = useMeetingNotes();
  const { data: employees = [], isLoading: isLoadingEmployees } = useAvailableEmployees();
  const { t } = useAppTranslation();
  const { toast } = useToast();

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.discussion_point.trim()) return;

    setIsSubmitting(true);

    try {
      const requestByName = formData.request_by
        ? (employees.find((e) => e.id === formData.request_by)?.full_name ?? formData.request_by)
        : '';
      await addMeetingPoint({
        discussion_point: formData.discussion_point,
        request_by: requestByName,
        status: formData.status,
        meeting_date: new Date().toISOString().split('T')[0]
      });

      setFormData({
        discussion_point: '',
        request_by: formData.request_by,
        status: 'Not Started'
      });
    } catch (error) {
      logger.error('Error submitting meeting point:', error);
      toast({ title: 'Error', description: 'Failed to add meeting point', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const selectedEmployeeName = formData.request_by
    ? (employees.find((e) => e.id === formData.request_by)?.full_name ?? formData.request_by)
    : '';

  const statusOption = STATUS_OPTIONS.find((o) => o.value === formData.status);
  const statusLabel = statusOption ? t(statusOption.labelKey, formData.status) : formData.status;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900/40 rounded-lg p-2.5">
      <form onSubmit={handleSubmit} className="space-y-2">
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          {t('meetingNotes.input.quickAdd', 'Quick Add Meeting Point')}
        </h3>

        <div className="flex flex-col md:flex-row gap-2 items-start">
          <div className="flex-1 w-full flex flex-col">
            <Textarea
              placeholder={t('meetingNotes.input.enterDiscussionPoint', 'Enter discussion point...')}
              value={formData.discussion_point}
              onChange={(e) => handleInputChange('discussion_point', e.target.value)}
              onKeyDown={handleKeyPress}
              className="min-h-[60px] max-h-[60px] md:min-h-[60px] md:max-h-[60px] resize-none text-sm w-full"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('meetingNotes.input.enterToAdd', 'Enter to add, Shift+Enter for new line')}
            </p>
          </div>

          {/* Employee & Status: two separate drawers */}
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            {/* Employee drawer */}
            <div className="w-full md:w-48 flex flex-col">
              <Drawer open={employeeDrawerOpen} onOpenChange={setEmployeeDrawerOpen}>
              <DrawerTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 text-sm w-full justify-between gap-2 text-left px-3 border-gray-200"
                >
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    <User className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {isLoadingEmployees
                        ? t('meetingNotes.input.loading', 'Loading...')
                        : selectedEmployeeName || t('meetingNotes.input.selectEmployee', 'Select employee')}
                    </span>
                  </span>
                  <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[85dvh] flex flex-col">
                <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                  <DrawerTitle className="text-lg font-semibold">
                    {t('meetingNotes.filters.requestBy', 'Request By')}
                  </DrawerTitle>
                </DrawerHeader>
                <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4">
                  {isLoadingEmployees ? (
                    <p className="text-sm text-muted-foreground">{t('meetingNotes.input.loading', 'Loading...')}</p>
                  ) : (
                    <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          handleInputChange('request_by', '');
                          setEmployeeDrawerOpen(false);
                        }}
                        className={cn(
                          'px-3 py-2.5 rounded-md text-sm border text-left transition-colors',
                          !formData.request_by
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-input hover:bg-muted'
                        )}
                      >
                        {t('meetingNotes.filters.allRequestBy', 'All Request By')}
                      </button>
                      {employees.map((employee) => (
                        <button
                          key={employee.id}
                          type="button"
                          onClick={() => {
                            handleInputChange('request_by', employee.id);
                            setEmployeeDrawerOpen(false);
                          }}
                          className={cn(
                            'px-3 py-2.5 rounded-md text-sm border text-left transition-colors truncate',
                            formData.request_by === employee.id
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-input hover:bg-muted'
                          )}
                        >
                          {employee.full_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                  <DrawerClose asChild>
                    <Button className="w-full" size="sm">
                      {t('meetingNotes.filters.done', 'Done')}
                    </Button>
                  </DrawerClose>
                </div>
              </DrawerContent>
              </Drawer>
            </div>

            {/* Status drawer */}
            <div className="w-full md:w-32 flex flex-col">
            <Drawer open={statusDrawerOpen} onOpenChange={setStatusDrawerOpen}>
              <DrawerTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 text-sm w-full justify-between gap-2 text-left px-3 border-gray-200"
                >
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    <CircleDot className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate">{statusLabel}</span>
                  </span>
                  <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[85dvh] flex flex-col">
                <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                  <DrawerTitle className="text-lg font-semibold">
                    {t('meetingNotes.filters.status', 'Status')}
                  </DrawerTitle>
                </DrawerHeader>
                <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          handleInputChange('status', opt.value);
                          setStatusDrawerOpen(false);
                        }}
                        className={cn(
                          'px-3 py-2 rounded-md text-sm border transition-colors',
                          formData.status === opt.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-input hover:bg-muted'
                        )}
                      >
                        {t(opt.labelKey, opt.value)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                  <DrawerClose asChild>
                    <Button className="w-full" size="sm">
                      {t('meetingNotes.filters.done', 'Done')}
                    </Button>
                  </DrawerClose>
                </div>
              </DrawerContent>
            </Drawer>
            </div>
          </div>
          <div className="h-5 md:hidden" />

          <div className="flex flex-col w-full md:w-auto">
            <Button
              type="submit"
              className="min-w-[120px] flex items-center justify-center gap-1.5 h-9 px-6 w-full md:w-auto"
              disabled={!formData.discussion_point.trim() || isSubmitting}
            >
              {t('meetingNotes.input.add', 'Add')}
            </Button>
            <div className="h-5" />
          </div>
        </div>
      </form>
    </div>
  );
};

export default MeetingNotesInput;
