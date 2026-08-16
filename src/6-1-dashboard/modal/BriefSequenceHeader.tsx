import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Check, MoreVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';

export interface BriefSequenceHeaderProps {
  name: string;
  canRename: boolean;
  canDelete: boolean;
  onRename: (name: string) => void;
  onDelete?: () => void;
  onAddRow?: () => void;
  className?: string;
}

export const BriefSequenceHeader: React.FC<BriefSequenceHeaderProps> = ({
  name,
  canRename,
  canDelete,
  onRename,
  onDelete,
  onAddRow,
  className,
}) => {
  const { t } = useAppTranslation();
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  useEffect(() => {
    if (isRenaming) inputRef.current?.focus();
  }, [isRenaming]);

  const commit = () => {
    const next = draft.trim() || name;
    onRename(next);
    setDraft(next);
    setIsRenaming(false);
  };

  const cancel = () => {
    setDraft(name);
    setIsRenaming(false);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50/70 px-2 py-1.5',
        className,
      )}
    >
      {isRenaming ? (
        <>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            className="h-7 min-w-0 flex-1 rounded border border-blue-200 bg-white px-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={t('briefDialog.layout.sequencePlaceholder', 'Sequence name (e.g. CTA)')}
          />
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={commit}>
            <Check className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500" onClick={cancel}>
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm font-semibold text-blue-900"
              >
                {name}
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              className="z-[110] w-auto max-w-[min(92vw,360px)] px-3 py-1.5 text-sm whitespace-normal break-words"
            >
              {name}
            </PopoverContent>
          </Popover>
          {(canRename || onAddRow || (canDelete && onDelete)) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-blue-700 hover:bg-blue-100"
                  title={t('common.actions', 'Actions')}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canRename ? (
                  <DropdownMenuItem onClick={() => setIsRenaming(true)} className="gap-2">
                    <Pencil className="h-4 w-4" />
                    {t('briefDialog.layout.renameSequence', 'Rename')}
                  </DropdownMenuItem>
                ) : null}
                {onAddRow ? (
                  <DropdownMenuItem onClick={onAddRow} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('briefDialog.addRow', 'Add row')}
                  </DropdownMenuItem>
                ) : null}
                {canDelete && onDelete ? (
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="gap-2 text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('briefDialog.layout.deleteSequence', 'Delete sequence')}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </>
      )}
    </div>
  );
};
