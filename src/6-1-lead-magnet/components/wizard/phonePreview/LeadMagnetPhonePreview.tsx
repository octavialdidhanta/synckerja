import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import type { LeadMagnetCampaignForm } from '../../../types/leadMagnet.types';
import {
  buildPhonePreviewModel,
  type PhonePreviewTab,
} from './buildPhonePreviewModel';
import { IgCommentsScreen } from './IgCommentsScreen';
import { IgDmScreen } from './IgDmScreen';
import { IgPostScreen } from './IgPostScreen';

/** Crop public/handphone.png (1080×1350) to the device outline. */
const PNG_W = 1080;
const PNG_H = 1350;
const PHONE_OUTER = { left: 292, top: 76, right: 864, bottom: 1209 } as const;
const PHONE_W = PHONE_OUTER.right - PHONE_OUTER.left;
const PHONE_H = PHONE_OUTER.bottom - PHONE_OUTER.top;
const PHONE_CROP = {
  left: PHONE_OUTER.left / PNG_W,
  top: PHONE_OUTER.top / PNG_H,
  width: PHONE_W / PNG_W,
  height: PHONE_H / PNG_H,
} as const;

type LeadMagnetPhonePreviewProps = {
  form: LeadMagnetCampaignForm;
  accountLabel: string;
  accountAvatarUrl: string | null;
};

const TABS: PhonePreviewTab[] = ['post', 'comments', 'dm'];

export function LeadMagnetPhonePreview({
  form,
  accountLabel,
  accountAvatarUrl,
}: LeadMagnetPhonePreviewProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<PhonePreviewTab>('post');

  const model = useMemo(
    () =>
      buildPhonePreviewModel(form, {
        accountLabel,
        accountAvatarUrl,
        sampleUsername: 'Username',
      }),
    [form, accountLabel, accountAvatarUrl],
  );

  const emptyMediaLabel = t('leadMagnet.wizard.phonePreview.emptyPost');
  const tabLabel = (key: PhonePreviewTab) => {
    if (key === 'post') return t('leadMagnet.wizard.phonePreview.tabPost');
    if (key === 'comments') return t('leadMagnet.wizard.phonePreview.tabComments');
    return t('leadMagnet.wizard.phonePreview.tabDm');
  };

  return (
    <div
      className="flex w-full flex-col items-center gap-2.5 overflow-hidden"
      aria-label={t('leadMagnet.wizard.phonePreview.ariaLabel')}
    >
      <div
        className="relative mx-auto shrink-0"
        style={{
          aspectRatio: `${PHONE_W} / ${PHONE_H}`,
          width: `min(300px, 100%, calc((100vh - 180px) * ${PHONE_W} / ${PHONE_H}))`,
          maxHeight: 'calc(100vh - 180px)',
        }}
      >
        {/* Full-bleed screen; frame PNG on top covers bezel + rounded corners */}
        <div className="absolute inset-[1.8%] z-0 overflow-hidden rounded-[1.75rem] bg-black">
          {tab === 'post' ? (
            <IgPostScreen model={model} emptyMediaLabel={emptyMediaLabel} />
          ) : null}
          {tab === 'comments' ? (
            <IgCommentsScreen
              model={model}
              emptyMediaLabel={emptyMediaLabel}
              nowLabel={t('leadMagnet.wizard.phonePreview.now')}
              replyLabel={t('leadMagnet.wizard.phonePreview.reply')}
              addCommentPlaceholder={t('leadMagnet.wizard.phonePreview.addComment')}
            />
          ) : null}
          {tab === 'dm' ? (
            <IgDmScreen
              model={model}
              messagePlaceholder={t('leadMagnet.wizard.phonePreview.messagePlaceholder')}
            />
          ) : null}
        </div>

        <img
          src="/handphone.png"
          alt=""
          className="pointer-events-none absolute z-10 max-w-none select-none"
          style={{
            width: `${(100 / PHONE_CROP.width).toFixed(3)}%`,
            height: `${(100 / PHONE_CROP.height).toFixed(3)}%`,
            left: `${((-PHONE_CROP.left / PHONE_CROP.width) * 100).toFixed(3)}%`,
            top: `${((-PHONE_CROP.top / PHONE_CROP.height) * 100).toFixed(3)}%`,
          }}
          draggable={false}
        />
      </div>

      <div className="flex w-full justify-center px-1">
        <div
          className="inline-flex w-full max-w-[280px] shrink-0 items-center justify-center rounded-full border border-border/80 bg-[#E8E8E8] p-1 shadow-sm"
          role="tablist"
          aria-label={t('leadMagnet.wizard.phonePreview.tabsAria')}
        >
          {TABS.map((key) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                className={cn(
                  'min-w-0 flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tabLabel(key)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
