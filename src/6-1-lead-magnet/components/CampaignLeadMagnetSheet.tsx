import { useEffect, useMemo, useState } from 'react';
import { FileText, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLeadMagnetPreviewSource } from '../hooks/useLeadMagnetPreviewSource';
import { summarizeCampaignLeadMagnet } from '../lib/summarizeCampaignLeadMagnet';
import type { LeadMagnetCampaign } from '../types/leadMagnet.types';
import { SUPABASE_URL } from '@/shared/lib/supabaseClient';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';

type Props = {
  campaign: LeadMagnetCampaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type PreviewCandidate = {
  id: string;
  label: string;
  url: string | null;
  storagePath: string | null;
  fileName: string | null;
  fileMime: string | null;
};

export function CampaignLeadMagnetSheet({ campaign, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const summary = campaign ? summarizeCampaignLeadMagnet(campaign, SUPABASE_URL) : null;

  const previewCandidates = useMemo((): PreviewCandidate[] => {
    if (!summary) return [];
    const items: PreviewCandidate[] = [];
    if (summary.mode === 'upload' && (summary.fileStoragePath || summary.filePublicUrl)) {
      items.push({
        id: 'file',
        label: summary.fileName || t('leadMagnet.list.leadMagnetFile'),
        url: summary.filePublicUrl,
        storagePath: summary.fileStoragePath,
        fileName: summary.fileName,
        fileMime: summary.fileMime,
      });
    }
    summary.links.forEach((link, index) => {
      if (!link.url.trim()) return;
      items.push({
        id: `link-${index}`,
        label: link.label.trim() || t('leadMagnet.list.leadMagnetUntitledLink'),
        url: link.url.trim(),
        storagePath: null,
        fileName: null,
        fileMime: null,
      });
    });
    return items;
  }, [summary, t]);

  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setActiveId(null);
      return;
    }
    setActiveId(previewCandidates[0]?.id ?? null);
  }, [open, campaign?.id, previewCandidates]);

  const active = previewCandidates.find((c) => c.id === activeId) ?? previewCandidates[0] ?? null;

  const preview = useLeadMagnetPreviewSource({
    open: open && Boolean(active),
    storagePath: active?.storagePath,
    fileName: active?.fileName,
    fileMime: active?.fileMime,
    url: active?.url,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <SheetHeader className="flex-shrink-0 space-y-1 border-b border-border px-6 py-4 pr-12 text-left">
          <SheetTitle className="text-base">
            {t('leadMagnet.list.leadMagnetSheetTitle')}
          </SheetTitle>
          <SheetDescription className="truncate text-xs">
            {campaign?.name ?? '—'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          {!campaign || !summary ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              {t('leadMagnet.list.leadMagnetEmpty')}
            </p>
          ) : !summary.hasContent ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              {t('leadMagnet.list.leadMagnetEmpty')}
            </p>
          ) : (
            <>
              <div className="flex-shrink-0 space-y-3 border-b border-border px-6 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[11px]">
                    {summary.mode === 'upload'
                      ? t('leadMagnet.wizard.deliveryModeUpload')
                      : t('leadMagnet.wizard.deliveryModeLink')}
                  </Badge>
                  {summary.mode === 'upload' && summary.fileSizeLabel ? (
                    <span className="text-xs text-muted-foreground">{summary.fileSizeLabel}</span>
                  ) : null}
                </div>

                {previewCandidates.length > 1 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {previewCandidates.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveId(item.id)}
                        className={cn(
                          'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs transition-colors',
                          active?.id === item.id
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60',
                        )}
                      >
                        {item.id === 'file' ? (
                          <FileText className="h-3 w-3 shrink-0" />
                        ) : (
                          <Link2 className="h-3 w-3 shrink-0" />
                        )}
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                ) : active ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {active.id === 'file' ? (
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Link2 className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="truncate font-medium text-foreground">{active.label}</span>
                  </div>
                ) : null}

                {summary.deliveryText ? (
                  <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                    {summary.deliveryText}
                  </p>
                ) : null}
              </div>

              <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
                {preview.loading ? (
                  <div className="flex flex-1 items-center justify-center px-6 py-8 text-sm text-muted-foreground">
                    {t('leadMagnet.list.leadMagnetPreviewLoading')}
                  </div>
                ) : preview.kind === 'unsupported' ? (
                  <div className="flex flex-1 items-center justify-center px-6 py-8 text-center text-sm text-muted-foreground">
                    {t('leadMagnet.list.leadMagnetPreviewUnsupported')}
                  </div>
                ) : preview.error || !preview.src ? (
                  <div className="flex flex-1 items-center justify-center px-6 py-8 text-center text-sm text-muted-foreground">
                    {t('leadMagnet.list.leadMagnetPreviewFailed')}
                  </div>
                ) : preview.kind === 'pdf' ? (
                  <iframe
                    key={preview.src}
                    src={preview.src}
                    title={t('leadMagnet.list.leadMagnetPreviewTitle')}
                    className="h-full min-h-[420px] w-full flex-1 border-0 bg-background"
                  />
                ) : (
                  <iframe
                    key={preview.src}
                    src={preview.src}
                    title={t('leadMagnet.list.leadMagnetPreviewTitle')}
                    className="h-full min-h-[420px] w-full flex-1 border-0 bg-background"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                    referrerPolicy="no-referrer"
                  />
                )}
                <p className="flex-shrink-0 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                  {t('leadMagnet.list.leadMagnetPreviewHint')}
                </p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
