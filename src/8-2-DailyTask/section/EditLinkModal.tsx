import React, { useState, useEffect } from 'react';
import { Link, X, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { useToast } from '@/shared/components/ui/use-toast';
import { supabase } from '@/shared/lib/supabaseClient';

interface StepLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  created_at: string;
  is_auto_synced?: boolean;
  source_social_media_plan_id?: string | null;
}

interface EditLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  link: StepLink | null;
  onSuccess?: () => void;
}

export const EditLinkModal: React.FC<EditLinkModalProps> = ({
  isOpen,
  onClose,
  link,
  onSuccess
}) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoSynced, setIsAutoSynced] = useState(false);
  const [isFetchingLinkDetails, setIsFetchingLinkDetails] = useState(false);
  const { toast } = useToast();

  // Fetch link details to check if it's auto-synced
  useEffect(() => {
    const fetchLinkDetails = async () => {
      if (!link) return;
      
      setIsFetchingLinkDetails(true);
      try {
        const { data, error } = await (supabase as any)
          .from('task_step_links')
          .select('is_auto_synced, source_social_media_plan_id')
          .eq('id', link.id)
          .single();

        if (error) throw error;
        
        setIsAutoSynced(data?.is_auto_synced === true);
      } catch (error: any) {
        console.error('Error fetching link details:', error);
        // If error, assume not auto-synced to allow editing
        setIsAutoSynced(false);
      } finally {
        setIsFetchingLinkDetails(false);
      }
    };

    fetchLinkDetails();
  }, [link]);

  // Populate form when link changes
  useEffect(() => {
    if (link) {
      setTitle(link.title);
      setUrl(link.url);
      setDescription(link.description || '');
      // Also check if link already has is_auto_synced property
      if (link.is_auto_synced !== undefined) {
        setIsAutoSynced(link.is_auto_synced);
      }
    }
  }, [link]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!link) return;
    
    // Prevent editing auto-synced links
    if (isAutoSynced) {
      toast({
        title: 'Cannot Edit',
        description: 'This link is auto-synced from Social Media Plan and cannot be edited manually. Changes to the link will be automatically synced from the source.',
        variant: 'destructive',
      });
      return;
    }
    
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
      const { error } = await (supabase as any)
        .from('task_step_links')
        .update({
          title: title.trim(),
          url: url.trim(),
          description: description.trim() || null,
        })
        .eq('id', link.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Link updated successfully',
      });

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error updating link:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update link',
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

  if (!link) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="w-5 h-5" />
            Edit Link
          </DialogTitle>
          <DialogDescription>
            Update the link information for this step.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {isAutoSynced && (
            <Alert variant="default" className="bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-sm text-yellow-800">
                This link is automatically synced from a Social Media Plan. Changes to the link will be automatically updated from the source. Manual editing is disabled.
              </AlertDescription>
            </Alert>
          )}
          
          <div>
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter link title"
              disabled={isLoading || isAutoSynced}
              required
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">URL *</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              type="url"
              disabled={isLoading || isAutoSynced}
              required
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">Description (Optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter link description"
              disabled={isLoading || isAutoSynced}
              rows={3}
            />
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isAutoSynced || !title.trim() || !url.trim()}
            >
              {isLoading ? 'Updating...' : 'Update Link'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
