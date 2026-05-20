import { useCallback, useState } from 'react';
import { MoreVertical, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import type { Service } from '@/6-1-product-knowledge/hooks/useServices';

type LivechatConversionMasterDataActionsProps = {
  kind: 'service' | 'category';
  servicesList: Service[];
  /** Required for category when parent line has no service yet. */
  defaultServiceId?: string;
  disabled?: boolean;
  onRefresh: () => void | Promise<void>;
  onCreated: (name: string) => void;
  t: (key: string, fallback?: string, variables?: Record<string, string | number>) => string;
};

/**
 * Add service/category from inside the conversion modal without portaling
 * outside the parent Radix Dialog (avoids Save clicks being treated as outside).
 */
export function LivechatConversionMasterDataActions({
  kind,
  servicesList,
  defaultServiceId = '',
  disabled = false,
  onRefresh,
  onCreated,
  t,
}: LivechatConversionMasterDataActionsProps) {
  const { organizationId } = useCurrentOrg();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [serviceId, setServiceId] = useState(defaultServiceId);
  const [saving, setSaving] = useState(false);

  const openAdd = useCallback(() => {
    setDraftName('');
    setServiceId(defaultServiceId || '');
    setDialogOpen(true);
  }, [defaultServiceId]);

  const handleSave = useCallback(async () => {
    const name = draftName.trim();
    if (!name) return;
    if (!organizationId) {
      toast.error(t('whatsappInbox.orgRequired', 'Organization not found'));
      return;
    }

    setSaving(true);
    try {
      if (kind === 'service') {
        const { error } = await supabase.from('services').insert({
          name,
          organization_id: organizationId,
          is_active: true,
        });
        if (error) throw error;
      } else {
        const sid = serviceId || defaultServiceId;
        if (!sid) {
          toast.error(
            t('whatsappInbox.selectServiceBeforeCategory', 'Select a service on this line first'),
          );
          return;
        }
        const { error } = await supabase.from('sub_services').insert({
          name,
          service_id: sid,
          organization_id: organizationId,
          is_active: true,
        });
        if (error) throw error;
      }

      toast.success(
        kind === 'service'
          ? t('whatsappInbox.serviceAdded', 'Service added')
          : t('whatsappInbox.categoryAdded', 'Category added'),
      );
      await onRefresh();
      onCreated(name);
      setDialogOpen(false);
      setDraftName('');
    } catch (err) {
      console.error('LivechatConversionMasterDataActions save failed:', err);
      toast.error(
        kind === 'service'
          ? t('whatsappInbox.serviceAddFailed', 'Failed to add service')
          : t('whatsappInbox.categoryAddFailed', 'Failed to add category'),
      );
    } finally {
      setSaving(false);
    }
  }, [
    draftName,
    organizationId,
    kind,
    serviceId,
    defaultServiceId,
    onRefresh,
    onCreated,
    t,
  ]);

  const addLabel =
    kind === 'service'
      ? t('whatsappInbox.addService', 'Add service')
      : t('whatsappInbox.addCategory', 'Add category');

  const dialogTitle =
    kind === 'service'
      ? t('whatsappInbox.newServiceTitle', 'New service')
      : t('whatsappInbox.newCategoryTitle', 'New category');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-gray-100"
            disabled={disabled}
            aria-label={addLabel}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[100]">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              openAdd();
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {addLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="z-[200] max-w-sm gap-4"
          overlayClassName="z-[199]"
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          {kind === 'category' ? (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {t('whatsappInbox.service', 'Service')} <span className="text-red-500">*</span>
              </label>
              <Select value={serviceId || undefined} onValueChange={setServiceId} disabled={saving}>
                <SelectTrigger className="h-9 w-full bg-white">
                  <SelectValue placeholder={t('whatsappInbox.selectService', 'Select service')} />
                </SelectTrigger>
                <SelectContent className="z-[250]">
                  {servicesList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {t('whatsappInbox.name', 'Name')} <span className="text-red-500">*</span>
            </label>
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={
                kind === 'service'
                  ? t('whatsappInbox.serviceNamePlaceholder', 'Enter service name')
                  : t('whatsappInbox.categoryNamePlaceholder', 'Enter category name')
              }
              disabled={saving}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSave();
                }
              }}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              {t('whatsappInbox.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={
                saving ||
                !draftName.trim() ||
                (kind === 'category' && !(serviceId || defaultServiceId))
              }
            >
              {saving ? t('whatsappInbox.saving', 'Saving…') : t('whatsappInbox.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
