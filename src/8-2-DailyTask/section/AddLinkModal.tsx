import React, { useState } from 'react';
import { Link } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { useToast } from '@/shared/components/ui/use-toast';
import { supabase } from '@/shared/lib/supabaseClient';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskStepId: string;
  onSuccess?: () => void;
}

export const AddLinkModal: React.FC<AddLinkModalProps> = ({
  isOpen,
  onClose,
  taskStepId,
  onSuccess
}) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !url.trim()) {
      toast({
        title: 'Error',
        description: 'Title and URL are required',
        variant: 'destructive',
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      toast({
        title: 'Error',
        description: 'Please enter a valid URL',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await (supabase as any)
        .from('task_step_links')
        .insert({
          task_step_id: taskStepId,
          title: title.trim(),
          url: url.trim(),
          description: description.trim() || null,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Link added successfully',
      });

      // Reset form
      setTitle('');
      setUrl('');
      setDescription('');
      
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error adding link:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add link',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setTitle('');
      setUrl('');
      setDescription('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          'p-0 flex flex-col gap-0',
          isMobile
            ? 'fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-[100dvh] rounded-none modal-above-safe-area'
            : 'max-w-md'
        )}
        hideCloseButton={isMobile}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={cn(
            'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left',
            isMobile ? 'safe-area-top px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4'
          )}
        >
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Link className="w-5 h-5 flex-shrink-0" />
            Add Link
          </DialogTitle>
          {!isMobile && (
            <DialogDescription>
              Add a link to this step for reference or resources.
            </DialogDescription>
          )}
        </DialogHeader>

        <div
          className={cn(
            'flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll',
            isMobile ? 'px-4 pt-4 pb-4' : 'px-6 pb-6'
          )}
          style={
            !isMobile
              ? undefined
              : {
                  scrollbarWidth: 'thin',
                  scrollBehavior: 'smooth',
                  scrollbarColor: '#d1d5db transparent',
                }
          }
        >
          <form id="add-link-form" onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="space-y-4 flex-1 min-h-0">
              <div>
                <label className="text-sm font-medium">Title *</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter link title"
                  disabled={isLoading}
                  required
                  className="text-sm mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">URL *</label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  type="url"
                  disabled={isLoading}
                  required
                  className="text-sm mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description (Optional)</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter link description"
                  disabled={isLoading}
                  rows={3}
                  className="text-sm mt-1"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer - rules: px-4 pt-3 pb-3, no safe-area-padding-bottom, two-layer, size="sm", loading spinner */}
        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-link-form"
              size="sm"
              disabled={isLoading || !title.trim() || !url.trim()}
              className="min-w-[120px] flex items-center justify-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                'Add Link'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
