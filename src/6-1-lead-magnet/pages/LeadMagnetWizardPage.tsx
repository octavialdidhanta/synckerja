import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, CircleHelp, ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { LeadMagnetPageShell } from '../components/LeadMagnetPageShell';
import {
  useCreateLeadMagnetCampaign,
  useLeadMagnetCampaign,
  useLeadMagnetMediaPosts,
  usePublishLeadMagnetCampaign,
  useUpdateLeadMagnetCampaign,
} from '../hooks/useLeadMagnetCampaigns';
import { useLeadMagnetMetaAccounts } from '../hooks/useLeadMagnetMetaAccounts';
import { LEAD_MAGNET_PATHS } from '../lib/leadMagnetPaths';
import {
  countPostsForPlatform,
  DEFAULT_LEAD_MAGNET_FORM,
  getAccountForPlatform,
  getCampaignAccounts,
  isPlatformEnabled,
  type LeadMagnetCampaign,
  type LeadMagnetCampaignAccount,
  type LeadMagnetCampaignForm,
  type LeadMagnetMediaPost,
  type LeadMagnetPlatform,
} from '../types/leadMagnet.types';
import { LeadMagnetContactChannelStep } from '../components/wizard/LeadMagnetContactChannelStep';
import { LeadMagnetCommentReplyVariantsStep } from '../components/wizard/LeadMagnetCommentReplyVariantsStep';
import { LeadMagnetDeliveryLinksStep } from '../components/wizard/LeadMagnetDeliveryLinksStep';
import { LeadMagnetPhonePreview } from '../components/wizard/phonePreview/LeadMagnetPhonePreview';
import {
  filledCommentReplyTexts,
  hasDuplicateCommentReplies,
  syncCommentReplyLegacyMirror,
  toCommentReplySlots,
} from '../lib/commentReplyVariants';
import { validateEmailCollectionStep, validateWhatsAppDeliveryStep } from '../lib/contactGate/validateContactGateStep';
import { useLeadMagnetWhatsAppAccounts } from '../hooks/useLeadMagnetWhatsAppAccounts';
import { updateLeadMagnetCampaign } from '../lib/leadMagnetApi';
import { parseLeadMagnetDeliveryMode, validateLeadMagnetDeliveryForm } from '../lib/leadMagnetDeliveryAsset';
import {
  DEFAULT_DELIVERY_LINK_LABEL,
  mirrorDeliveryFieldsFromLinks,
  resolveDeliveryLinks,
} from '../lib/deliveryLinks';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Switch } from '@/shared/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

const STEP_CONFIG = [
  { labelKey: 'leadMagnet.wizard.steps.basics' },
  { labelKey: 'leadMagnet.wizard.steps.post' },
  { labelKey: 'leadMagnet.wizard.steps.keyword' },
  { labelKey: 'leadMagnet.wizard.steps.messages' },
  { labelKey: 'leadMagnet.wizard.steps.contactChannel' },
  { labelKey: 'leadMagnet.wizard.steps.delivery' },
  { labelKey: 'leadMagnet.wizard.steps.review' },
] as const;

function isLegacyWaOrEmailContactCopy(text: string): boolean {
  const value = text.trim();
  if (!value) return true;
  return /whatsapp|nomor\s*wa|\bwa\b|contoh\s*wa|\b081\d|atau\s+email/i.test(value);
}

function normalizeEmailCollectionCopy(
  prompt: string | null | undefined,
  invalid: string | null | undefined,
): { contact_prompt_text: string; contact_invalid_text: string } {
  const promptText = prompt?.trim() ?? '';
  const invalidText = invalid?.trim() ?? '';
  return {
    contact_prompt_text: isLegacyWaOrEmailContactCopy(promptText)
      ? DEFAULT_LEAD_MAGNET_FORM.contact_prompt_text
      : promptText,
    contact_invalid_text: isLegacyWaOrEmailContactCopy(invalidText)
      ? DEFAULT_LEAD_MAGNET_FORM.contact_invalid_text
      : invalidText,
  };
}

function isLegacyFollowGateCopy(text: string): boolean {
  const value = text.trim();
  if (!value) return true;
  return /tab\s*permintaan|makasih sudah komen|supaya materi masuk inbox/i.test(value);
}

function campaignToForm(c: LeadMagnetCampaign): LeadMagnetCampaignForm {
  const accounts = getCampaignAccounts(c);
  const posts = (c.lead_magnet_campaign_posts ?? []).map((p) => ({
    platform: p.platform ?? (accounts[0]?.platform ?? 'instagram'),
    media_id: p.media_id,
    media_permalink: p.media_permalink,
    media_caption: p.media_caption ?? null,
    media_thumbnail_url: p.media_thumbnail_url ?? null,
  }));
  const replySlots = toCommentReplySlots(c.comment_reply_texts, c.comment_reply_text);
  const emailCopy = normalizeEmailCollectionCopy(c.contact_prompt_text, c.contact_invalid_text);
  const followGate = c.follow_gate_text?.trim() ?? '';
  const openingOffer = c.framework_offer_text?.trim() ?? '';
  const openingButton = c.framework_button_label?.trim() ?? '';
  const isLegacyOpeningOffer =
    !openingOffer ||
    /senang banget kamu di sini|klik di bawah ya|klik tombol di bawah, link-nya kami kirim sebentar lagi ✨/i.test(
      openingOffer,
    );
  const isLegacyOpeningButton =
    !openingButton || /^ambil materi$/i.test(openingButton);
  const deliveryTextRaw = c.delivery_text?.trim() ?? '';
  const isLegacyDeliveryText =
    !deliveryTextRaw
    || /ini materinya\.?\s*semoga bermanfaat/i.test(deliveryTextRaw);
  const resolvedLinks = resolveDeliveryLinks({
    delivery_links: c.delivery_links,
    delivery_button_label: c.delivery_button_label,
    delivery_url: c.delivery_url,
  }).map((link) => {
    const isLegacyLabel =
      !link.label.trim() || /^unduh$/i.test(link.label.trim());
    return {
      ...link,
      label: isLegacyLabel ? DEFAULT_DELIVERY_LINK_LABEL : link.label,
    };
  });
  const mirrored = mirrorDeliveryFieldsFromLinks(resolvedLinks);
  return {
    name: c.name,
    target_market: c.target_market ?? '',
    accounts,
    keyword: c.keyword,
    comment_reply_enabled: c.comment_reply_enabled ?? true,
    comment_reply_texts: replySlots,
    comment_reply_text: syncCommentReplyLegacyMirror(replySlots),
    follow_gate_text: isLegacyFollowGateCopy(followGate)
      ? DEFAULT_LEAD_MAGNET_FORM.follow_gate_text
      : followGate,
    follow_button_label: c.follow_button_label || DEFAULT_LEAD_MAGNET_FORM.follow_button_label,
    framework_offer_text: isLegacyOpeningOffer
      ? DEFAULT_LEAD_MAGNET_FORM.framework_offer_text
      : openingOffer,
    framework_button_label: isLegacyOpeningButton
      ? DEFAULT_LEAD_MAGNET_FORM.framework_button_label
      : openingButton,
    delivery_text: isLegacyDeliveryText
      ? DEFAULT_LEAD_MAGNET_FORM.delivery_text
      : deliveryTextRaw,
    delivery_button_label: mirrored.delivery_button_label,
    delivery_fallback_text: c.delivery_fallback_text ?? DEFAULT_LEAD_MAGNET_FORM.delivery_fallback_text,
    delivery_url: mirrored.delivery_url,
    delivery_links: resolvedLinks,
    delivery_mode: parseLeadMagnetDeliveryMode(c.delivery_mode),
    delivery_storage_path: c.delivery_storage_path ?? null,
    delivery_file_name: c.delivery_file_name ?? null,
    delivery_file_mime: c.delivery_file_mime ?? null,
    delivery_file_size_bytes: c.delivery_file_size_bytes ?? null,
    skip_follow_gate_if_follower: c.skip_follow_gate_if_follower,
    skip_material_offer: c.skip_material_offer ?? false,
    contact_gate_enabled: c.contact_gate_enabled ?? false,
    email_collection_enabled: c.email_collection_enabled ?? false,
    contact_prompt_text: emailCopy.contact_prompt_text,
    contact_invalid_text: emailCopy.contact_invalid_text,
    contact_ack_text: c.contact_ack_text ?? DEFAULT_LEAD_MAGNET_FORM.contact_ack_text,
    whatsapp_account_id: c.whatsapp_account_id ?? null,
    whatsapp_template_name: c.whatsapp_template_name ?? null,
    whatsapp_template_language: c.whatsapp_template_language ?? null,
    whatsapp_template_params: (c.whatsapp_template_params ?? {}) as Record<string, unknown>,
    email_subject: c.email_subject?.trim() || DEFAULT_LEAD_MAGNET_FORM.email_subject,
    email_html_body: c.email_html_body?.trim() || DEFAULT_LEAD_MAGNET_FORM.email_html_body,
    email_from_name: c.email_from_name ?? null,
    posts,
  };
}

function upsertAccount(
  accounts: LeadMagnetCampaignAccount[],
  platform: LeadMagnetPlatform,
  accountId: string,
): LeadMagnetCampaignAccount[] {
  const rest = accounts.filter((a) => a.platform !== platform);
  return [...rest, { platform, account_id: accountId.trim() }];
}

export function LeadMagnetWizardPage() {
  const { t } = useTranslation();
  const { campaignId } = useParams<{ campaignId: string }>();
  const isEdit = Boolean(campaignId);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<LeadMagnetCampaignForm>(DEFAULT_LEAD_MAGNET_FORM);
  const [localCampaignId, setLocalCampaignId] = useState<string | null>(null);

  const effectiveCampaignId = campaignId ?? localCampaignId;

  const { data: existing, isLoading: loadingExisting } = useLeadMagnetCampaign(campaignId);
  const {
    igAccounts,
    fbAccounts,
    isLoading: loadingAccounts,
    instagramSettingsPath,
    facebookSettingsPath,
  } = useLeadMagnetMetaAccounts();

  const igEnabled = isPlatformEnabled(form.accounts, 'instagram');
  const fbEnabled = isPlatformEnabled(form.accounts, 'facebook');
  const igAccountId = getAccountForPlatform(form.accounts, 'instagram');
  const fbAccountId = getAccountForPlatform(form.accounts, 'facebook');

  const { data: igMediaPosts = [], isLoading: loadingIgPosts } = useLeadMagnetMediaPosts(
    'instagram',
    igEnabled ? igAccountId : '',
  );
  const { data: fbMediaPosts = [], isLoading: loadingFbPosts } = useLeadMagnetMediaPosts(
    'facebook',
    fbEnabled ? fbAccountId : '',
  );

  const { organizationId } = useCurrentOrg();
  const { orgHasWhatsApp } = useLeadMagnetWhatsAppAccounts();

  const createMut = useCreateLeadMagnetCampaign();
  const updateMut = useUpdateLeadMagnetCampaign(effectiveCampaignId ?? '');
  const publishMut = usePublishLeadMagnetCampaign();
  const appliedNewCampaignReplyDefaults = useRef(false);

  useEffect(() => {
    if (existing || isEdit || appliedNewCampaignReplyDefaults.current) return;
    appliedNewCampaignReplyDefaults.current = true;
    setForm((f) => ({
      ...f,
      comment_reply_texts: [
        t('leadMagnet.wizard.commentReplyDefault1'),
        t('leadMagnet.wizard.commentReplyDefault2'),
        t('leadMagnet.wizard.commentReplyDefault3'),
      ],
      comment_reply_text: t('leadMagnet.wizard.commentReplyDefault1'),
      framework_offer_text: t('leadMagnet.wizard.openingDmDefault'),
      framework_button_label: DEFAULT_LEAD_MAGNET_FORM.framework_button_label,
    }));
  }, [existing, isEdit, t]);

  useEffect(() => {
    if (existing) setForm(campaignToForm(existing));
  }, [existing]);

  useEffect(() => {
    if (!existing) return;
    setForm((f) => {
      let changed = false;
      const enriched = f.posts.map((p) => {
        if (p.media_caption?.trim() && p.media_thumbnail_url?.trim()) return p;
        const pool = p.platform === 'instagram' ? igMediaPosts : fbMediaPosts;
        const meta = pool.find((m) => m.media_id === p.media_id);
        if (!meta) return p;
        const next = {
          ...p,
          media_caption: p.media_caption?.trim() || meta.caption || null,
          media_thumbnail_url: p.media_thumbnail_url?.trim()
            || meta.thumbnail_url
            || meta.media_url
            || null,
          media_permalink: p.media_permalink || meta.permalink,
        };
        if (
          next.media_caption !== p.media_caption
          || next.media_thumbnail_url !== p.media_thumbnail_url
          || next.media_permalink !== p.media_permalink
        ) {
          changed = true;
        }
        return next;
      });
      return changed ? { ...f, posts: enriched } : f;
    });
  }, [existing, igMediaPosts, fbMediaPosts]);

  const patch = (partial: Partial<LeadMagnetCampaignForm>) => setForm((f) => ({ ...f, ...partial }));

  const setPlatformEnabled = (platform: LeadMagnetPlatform, enabled: boolean) => {
    setForm((f) => {
      let accounts = enabled
        ? upsertAccount(f.accounts, platform, getAccountForPlatform(f.accounts, platform))
        : f.accounts.filter((a) => a.platform !== platform);
      const posts = enabled ? f.posts : f.posts.filter((p) => p.platform !== platform);
      return { ...f, accounts, posts };
    });
  };

  const setPlatformAccount = (platform: LeadMagnetPlatform, accountId: string) => {
    setForm((f) => ({
      ...f,
      accounts: upsertAccount(f.accounts, platform, accountId),
      posts: f.posts.filter((p) => p.platform !== platform),
    }));
  };

  const togglePost = (
    platform: LeadMagnetPlatform,
    mediaId: string,
    permalink: string | null,
    caption: string | null,
    thumbnailUrl: string | null,
  ) => {
    setForm((f) => {
      const exists = f.posts.some((p) => p.platform === platform && p.media_id === mediaId);
      if (exists) {
        return {
          ...f,
          posts: f.posts.filter((p) => !(p.platform === platform && p.media_id === mediaId)),
        };
      }
      return {
        ...f,
        posts: [...f.posts, {
          platform,
          media_id: mediaId,
          media_permalink: permalink,
          media_caption: caption,
          media_thumbnail_url: thumbnailUrl,
        }],
      };
    });
  };

  const validateStep = (stepIndex: number): string | null => {
    if (stepIndex === 0) {
      if (!form.name.trim()) return t('leadMagnet.wizard.validation.nameRequired');
      if (!igEnabled && !fbEnabled) return t('leadMagnet.wizard.validation.platformRequired');
      if (igEnabled && !igAccountId) return t('leadMagnet.wizard.validation.igAccountRequired');
      if (fbEnabled && !fbAccountId) return t('leadMagnet.wizard.validation.fbAccountRequired');
    }
    if (stepIndex === 1) {
      if (igEnabled && countPostsForPlatform(form.posts, 'instagram') === 0) {
        return t('leadMagnet.wizard.validation.igPostRequired');
      }
      if (fbEnabled && countPostsForPlatform(form.posts, 'facebook') === 0) {
        return t('leadMagnet.wizard.validation.fbPostRequired');
      }
    }
    if (stepIndex === 2) {
      if (!form.keyword.trim()) return t('leadMagnet.wizard.validation.keywordRequired');
      if (form.comment_reply_enabled) {
        if (filledCommentReplyTexts(form.comment_reply_texts).length === 0) {
          return t('leadMagnet.wizard.validation.commentReplyRequired');
        }
        if (hasDuplicateCommentReplies(form.comment_reply_texts)) {
          return t('leadMagnet.wizard.validation.commentReplyDuplicate');
        }
      }
    }
    if (stepIndex === 3) {
      return validateEmailCollectionStep(form, t);
    }
    if (stepIndex === 4) {
      return validateWhatsAppDeliveryStep(form, orgHasWhatsApp, t);
    }
    if (stepIndex === 5) {
      const deliveryErr = validateLeadMagnetDeliveryForm(form);
      if (deliveryErr) return t(`leadMagnet.wizard.validation.${deliveryErr}`);
    }
    return null;
  };

  const persistFormSnapshot = async (
    partial: Partial<LeadMagnetCampaignForm>,
    campaignIdOverride?: string,
  ) => {
    const nextForm = { ...form, ...partial };
    setForm(nextForm);
    const targetId = campaignIdOverride ?? effectiveCampaignId ?? null;
    try {
      if (targetId) {
        await updateLeadMagnetCampaign(targetId, nextForm);
        if (!effectiveCampaignId) {
          setLocalCampaignId(targetId);
          navigate(LEAD_MAGNET_PATHS.edit(targetId), { replace: true });
        }
        return;
      }
      const created = await createMut.mutateAsync(nextForm);
      setLocalCampaignId(created.id);
      navigate(LEAD_MAGNET_PATHS.edit(created.id), { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('leadMagnet.wizard.saveFailed'));
    }
  };

  const saveDraft = async (): Promise<string | null> => {
    try {
      if (effectiveCampaignId) {
        await updateMut.mutateAsync(form);
        return effectiveCampaignId;
      }
      const created = await createMut.mutateAsync(form);
      setLocalCampaignId(created.id);
      navigate(LEAD_MAGNET_PATHS.edit(created.id), { replace: true });
      return created.id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('leadMagnet.wizard.saveFailed'));
      return null;
    }
  };

  const validateTargetMarketForPublish = (): string | null => {
    const tm = form.target_market.trim();
    if (tm.length < 2) return t('leadMagnet.wizard.validation.targetMarketRequired');
    if (tm.length > 120) return t('leadMagnet.wizard.validation.targetMarketTooLong');
    return null;
  };

  const handlePublish = async () => {
    const err = validateStep(0)
      ?? validateStep(1)
      ?? validateStep(2)
      ?? validateStep(4)
      ?? validateStep(5)
      ?? validateTargetMarketForPublish();
    if (err) {
      toast.error(err);
      return;
    }
    try {
      let id = effectiveCampaignId;
      if (!id) {
        const created = await createMut.mutateAsync(form);
        id = created.id;
        setLocalCampaignId(created.id);
      } else {
        await updateMut.mutateAsync(form);
      }
      await publishMut.mutateAsync(id);
      toast.success(t('leadMagnet.wizard.publishSuccess'));
      navigate(LEAD_MAGNET_PATHS.list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('leadMagnet.wizard.publishFailed'));
    }
  };

  const next = async () => {
    if (step === STEP_CONFIG.length - 1) {
      await handlePublish();
      return;
    }
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(s + 1, STEP_CONFIG.length - 1));
  };

  const accountLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of [...igAccounts, ...fbAccounts]) map.set(a.id, a.label);
    return map;
  }, [igAccounts, fbAccounts]);

  const previewAccount = useMemo(() => {
    const ig = igAccountId
      ? igAccounts.find((a) => a.id === igAccountId)
      : undefined;
    if (ig) {
      return { label: ig.label, avatarUrl: ig.avatarUrl };
    }
    const fb = fbAccountId
      ? fbAccounts.find((a) => a.id === fbAccountId)
      : undefined;
    if (fb) {
      return { label: fb.label, avatarUrl: fb.avatarUrl };
    }
    return { label: 'brand', avatarUrl: null as string | null };
  }, [igAccountId, fbAccountId, igAccounts, fbAccounts]);

  if (isEdit && loadingExisting) {
    return null;
  }

  return (
    <LeadMagnetPageShell>
      <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-3 xl:max-w-7xl">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(LEAD_MAGNET_PATHS.list)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('leadMagnet.wizard.back')}
          </Button>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {STEP_CONFIG.map((stepConfig, i) => (
              <BadgeStep
                key={stepConfig.labelKey}
                active={i === step}
                done={i < step}
                label={t(stepConfig.labelKey)}
              />
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-background shadow-sm">
          <div
            className={cn(
              'scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              step === 1
                ? 'flex flex-col overflow-hidden'
                : 'overflow-y-auto',
            )}
          >
              {step === 0 && (
                <div className="min-h-full rounded-lg bg-[#F5F5F5] p-4">
                  <div className="space-y-5">
                      <WizardInputField
                        label={t('leadMagnet.wizard.campaignName')}
                        value={form.name}
                        onChange={(v) => patch({ name: v })}
                        placeholder={t('leadMagnet.wizard.campaignNamePlaceholder')}
                      />

                      <div className="space-y-1.5">
                        <Label htmlFor="target_market">{t('leadMagnet.wizard.targetMarket')}</Label>
                        <Input
                          id="target_market"
                          value={form.target_market}
                          onChange={(e) => patch({ target_market: e.target.value.slice(0, 120) })}
                          placeholder={t('leadMagnet.wizard.targetMarketPlaceholder')}
                          maxLength={120}
                        />
                        <p className="text-xs text-muted-foreground">{t('leadMagnet.wizard.targetMarketHint')}</p>
                      </div>

                      <PlatformAccountSection
                        platform="instagram"
                        title={t('leadMagnet.wizard.platformInstagram')}
                        enabled={igEnabled}
                        accountId={igAccountId}
                        accounts={igAccounts}
                        loading={loadingAccounts}
                        settingsPath={instagramSettingsPath}
                        emptyHint={t('leadMagnet.wizard.emptyInstagramAccounts')}
                        scopeHint={t('leadMagnet.wizard.scopeWarning')}
                        onEnabledChange={(checked) => setPlatformEnabled('instagram', checked)}
                        onAccountChange={(id) => setPlatformAccount('instagram', id)}
                      />

                      <PlatformAccountSection
                        platform="facebook"
                        title={t('leadMagnet.wizard.platformFacebook')}
                        enabled={fbEnabled}
                        accountId={fbAccountId}
                        accounts={fbAccounts}
                        loading={loadingAccounts}
                        settingsPath={facebookSettingsPath}
                        emptyHint={t('leadMagnet.wizard.emptyFacebookAccounts')}
                        scopeHint={t('leadMagnet.wizard.scopeWarning')}
                        onEnabledChange={(checked) => setPlatformEnabled('facebook', checked)}
                        onAccountChange={(id) => setPlatformAccount('facebook', id)}
                      />

                      <p className="text-xs text-muted-foreground">{t('leadMagnet.wizard.platformHint')}</p>
                    </div>
                  </div>
              )}

              {step === 1 && (
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  <p className="shrink-0 text-sm text-muted-foreground">
                    {t('leadMagnet.wizard.postStepHint', { count: form.posts.length })}
                  </p>
                  <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-[#F5F5F5] p-3">
                    {!igEnabled && !fbEnabled ? (
                      <p className="text-sm text-amber-600">{t('leadMagnet.wizard.selectPlatformFirst')}</p>
                    ) : igEnabled && fbEnabled ? (
                      <Tabs defaultValue="instagram" className="flex min-h-0 flex-1 flex-col">
                        <TabsList className="mb-2 shrink-0 bg-background">
                          <TabsTrigger value="instagram">
                            {t('leadMagnet.wizard.tabInstagram', {
                              count: countPostsForPlatform(form.posts, 'instagram'),
                            })}
                          </TabsTrigger>
                          <TabsTrigger value="facebook">
                            {t('leadMagnet.wizard.tabFacebook', {
                              count: countPostsForPlatform(form.posts, 'facebook'),
                            })}
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="instagram" className="mt-0 min-h-0 flex-1 overflow-hidden focus-visible:outline-none">
                          <PostPicker
                            platform="instagram"
                            accountId={igAccountId}
                            posts={igMediaPosts}
                            loading={loadingIgPosts}
                            selected={form.posts}
                            onToggle={togglePost}
                            selectAccountHint={t('leadMagnet.wizard.selectIgAccountFirst')}
                          />
                        </TabsContent>
                        <TabsContent value="facebook" className="mt-0 min-h-0 flex-1 overflow-hidden focus-visible:outline-none">
                          <PostPicker
                            platform="facebook"
                            accountId={fbAccountId}
                            posts={fbMediaPosts}
                            loading={loadingFbPosts}
                            selected={form.posts}
                            onToggle={togglePost}
                            selectAccountHint={t('leadMagnet.wizard.selectFbAccountFirst')}
                          />
                        </TabsContent>
                      </Tabs>
                    ) : (
                      <div className="min-h-0 flex-1">
                        <PostPicker
                          platform={igEnabled ? 'instagram' : 'facebook'}
                          accountId={igEnabled ? igAccountId : fbAccountId}
                          posts={igEnabled ? igMediaPosts : fbMediaPosts}
                          loading={igEnabled ? loadingIgPosts : loadingFbPosts}
                          selected={form.posts}
                          onToggle={togglePost}
                          selectAccountHint={
                            igEnabled
                              ? t('leadMagnet.wizard.selectIgAccountFirst')
                              : t('leadMagnet.wizard.selectFbAccountFirst')
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="min-h-full rounded-lg bg-[#F5F5F5] p-4">
                  <div className="space-y-5">
                    <WizardInputField
                      label={t('leadMagnet.wizard.keywordLabel')}
                      value={form.keyword}
                      onChange={(v) => patch({ keyword: v })}
                      placeholder={t('leadMagnet.wizard.keywordPlaceholder')}
                      hint={t('leadMagnet.wizard.keywordHint')}
                    />
                    <LeadMagnetCommentReplyVariantsStep
                      enabled={form.comment_reply_enabled}
                      texts={form.comment_reply_texts}
                      onChange={patch}
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="min-h-full rounded-lg bg-[#F5F5F5] p-4">
                  <div className="space-y-5">
                    <WizardFieldSection title={t('leadMagnet.wizard.frameworkOffer')}>
                      <WizardSkipOption
                        id="enable-opening-dm"
                        checked={!form.skip_material_offer}
                        onCheckedChange={(enabled) => patch({ skip_material_offer: !enabled })}
                        label={t('leadMagnet.wizard.enableOpeningDm')}
                        info={t('leadMagnet.wizard.enableOpeningDmHint')}
                      />
                      {!form.skip_material_offer ? (
                        <div className="space-y-3">
                          <MessageField
                            label={t('leadMagnet.wizard.frameworkOffer')}
                            value={form.framework_offer_text}
                            onChange={(v) => patch({ framework_offer_text: v })}
                            hint={t('leadMagnet.wizard.openingDmHint')}
                            hideLabel
                          />
                          <WizardButtonLabelField
                            variant="offer"
                            label={t('leadMagnet.wizard.frameworkButtonLabel')}
                            value={form.framework_button_label}
                            onChange={(v) => patch({ framework_button_label: v })}
                          />
                        </div>
                      ) : null}
                    </WizardFieldSection>

                    <WizardFieldSection title={t('leadMagnet.wizard.followGate')}>
                      <WizardSkipOption
                        id="enable-follow-gate"
                        checked={!form.skip_follow_gate_if_follower}
                        onCheckedChange={(enabled) => patch({ skip_follow_gate_if_follower: !enabled })}
                        label={t('leadMagnet.wizard.enableFollowGate')}
                        info={t('leadMagnet.wizard.enableFollowGateHint')}
                      />
                      {!form.skip_follow_gate_if_follower ? (
                        <div className="space-y-3">
                          <MessageField
                            label={t('leadMagnet.wizard.followGate')}
                            value={form.follow_gate_text}
                            onChange={(v) => patch({ follow_gate_text: v })}
                            hideLabel
                          />
                          <WizardButtonLabelField
                            variant="follow"
                            label={t('leadMagnet.wizard.followButtonLabel')}
                            value={form.follow_button_label}
                            onChange={(v) => patch({ follow_button_label: v })}
                          />
                        </div>
                      ) : null}
                    </WizardFieldSection>

                    <WizardFieldSection title={t('leadMagnet.wizard.emailCollection')}>
                      <WizardSkipOption
                        id="enable-email-collection"
                        checked={form.email_collection_enabled}
                        onCheckedChange={(enabled) => {
                          if (!enabled) {
                            patch({ email_collection_enabled: false });
                            return;
                          }
                          const emailCopy = normalizeEmailCollectionCopy(
                            form.contact_prompt_text,
                            form.contact_invalid_text,
                          );
                          patch({
                            email_collection_enabled: true,
                            contact_prompt_text: emailCopy.contact_prompt_text,
                            contact_invalid_text: emailCopy.contact_invalid_text,
                          });
                        }}
                        label={t('leadMagnet.wizard.enableEmailCollection')}
                        info={t('leadMagnet.wizard.enableEmailCollectionHint')}
                      />
                      {form.email_collection_enabled ? (
                        <div className="space-y-3">
                          <MessageField
                            label={t('leadMagnet.wizard.emailPromptLabel')}
                            value={form.contact_prompt_text}
                            onChange={(v) => patch({ contact_prompt_text: v })}
                          />
                          <MessageField
                            label={t('leadMagnet.wizard.emailInvalidLabel')}
                            value={form.contact_invalid_text}
                            onChange={(v) => patch({ contact_invalid_text: v })}
                          />
                        </div>
                      ) : null}
                    </WizardFieldSection>
                  </div>
                </div>
              )}

              {step === 4 && (
                <LeadMagnetContactChannelStep form={form} onChange={patch} />
              )}

              {step === 5 && (
                <div className="min-h-full rounded-lg bg-[#F5F5F5] p-4">
                  <div className="space-y-5">
                    <div className="space-y-3 rounded-lg border border-border/60 bg-background p-4 shadow-sm">
                      <MessageField
                        label={t('leadMagnet.wizard.deliveryMessage')}
                        value={form.delivery_text}
                        onChange={(v) => patch({ delivery_text: v })}
                      />
                    </div>
                    <LeadMagnetDeliveryLinksStep
                      form={form}
                      onPatch={patch}
                      organizationId={organizationId}
                      campaignId={effectiveCampaignId}
                      ensureCampaignId={saveDraft}
                      onPersistAfterUpload={persistFormSnapshot}
                    />
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="min-h-full rounded-lg bg-[#F5F5F5] p-4">
                  <div className="space-y-4">
                    <section className="rounded-lg border border-border/60 bg-background p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('leadMagnet.wizard.reviewSectionCampaign')}
                      </p>
                      <h3 className="mt-1 truncate text-base font-semibold text-foreground">
                        {form.name.trim() || '—'}
                      </h3>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <ReviewMetaRow
                          label={t('leadMagnet.wizard.reviewKeyword')}
                          value={form.keyword.trim() || '—'}
                          mono
                        />
                        <ReviewMetaRow
                          label={t('leadMagnet.wizard.targetMarket')}
                          value={form.target_market.trim() || '—'}
                        />
                      </div>
                    </section>

                    <section className="rounded-lg border border-border/60 bg-background p-4 shadow-sm">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('leadMagnet.wizard.reviewSectionPlatforms')}
                      </p>
                      <ul className="space-y-2">
                        {igEnabled ? (
                          <li className="flex items-start justify-between gap-3 rounded-md border border-border/50 bg-muted/30 px-3 py-2.5 text-sm">
                            <span className="font-medium text-foreground">Instagram</span>
                            <span className="text-right text-muted-foreground">
                              {accountLabelById.get(igAccountId) ?? igAccountId}
                              <span className="mt-0.5 block text-xs">
                                {t('leadMagnet.wizard.reviewPostsCount', {
                                  count: countPostsForPlatform(form.posts, 'instagram'),
                                })}
                              </span>
                            </span>
                          </li>
                        ) : null}
                        {fbEnabled ? (
                          <li className="flex items-start justify-between gap-3 rounded-md border border-border/50 bg-muted/30 px-3 py-2.5 text-sm">
                            <span className="font-medium text-foreground">Facebook</span>
                            <span className="text-right text-muted-foreground">
                              {accountLabelById.get(fbAccountId) ?? fbAccountId}
                              <span className="mt-0.5 block text-xs">
                                {t('leadMagnet.wizard.reviewPostsCount', {
                                  count: countPostsForPlatform(form.posts, 'facebook'),
                                })}
                              </span>
                            </span>
                          </li>
                        ) : null}
                        {!igEnabled && !fbEnabled ? (
                          <li className="text-sm text-muted-foreground">—</li>
                        ) : null}
                      </ul>
                    </section>

                    <section className="rounded-lg border border-border/60 bg-background p-4 shadow-sm">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('leadMagnet.wizard.reviewSectionFlow')}
                      </p>
                      <ul className="divide-y divide-border/60">
                        <ReviewToggleRow
                          label={t('leadMagnet.wizard.enableOpeningDm')}
                          on={!form.skip_material_offer}
                          onLabel={t('leadMagnet.wizard.reviewOn')}
                          offLabel={t('leadMagnet.wizard.reviewOff')}
                        />
                        <ReviewToggleRow
                          label={t('leadMagnet.wizard.enableFollowGate')}
                          on={!form.skip_follow_gate_if_follower}
                          onLabel={t('leadMagnet.wizard.reviewOn')}
                          offLabel={t('leadMagnet.wizard.reviewOff')}
                        />
                        <ReviewToggleRow
                          label={t('leadMagnet.wizard.enableEmailCollection')}
                          on={form.email_collection_enabled}
                          onLabel={t('leadMagnet.wizard.reviewOn')}
                          offLabel={t('leadMagnet.wizard.reviewOff')}
                        />
                        <ReviewToggleRow
                          label={t('leadMagnet.wizard.reviewWhatsAppDeliveryLabel')}
                          on={form.contact_gate_enabled}
                          onLabel={t('leadMagnet.wizard.reviewContactGateOn')}
                          offLabel={t('leadMagnet.wizard.reviewContactGateOff')}
                          detail={
                            form.contact_gate_enabled && form.whatsapp_template_name
                              ? form.whatsapp_template_name
                              : undefined
                          }
                        />
                      </ul>
                    </section>

                    <section className="rounded-lg border border-border/60 bg-background p-4 shadow-sm">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('leadMagnet.wizard.reviewSectionDelivery')}
                      </p>
                      <div className="space-y-2 text-sm">
                        <ReviewMetaRow
                          label={t('leadMagnet.wizard.deliveryMessage')}
                          value={form.delivery_text.trim() || '—'}
                        />
                        <ReviewMetaRow
                          label={t('leadMagnet.wizard.dmWithLink')}
                          value={t('leadMagnet.wizard.reviewDeliveryLinks', {
                            count: form.delivery_links?.length || (form.delivery_url ? 1 : 0),
                            first:
                              form.delivery_links?.[0]?.label
                              || form.delivery_button_label
                              || '—',
                          })}
                        />
                        {form.delivery_mode === 'upload' && form.delivery_file_name ? (
                          <ReviewMetaRow
                            label={t('leadMagnet.wizard.deliveryModeUpload')}
                            value={form.delivery_file_name}
                          />
                        ) : null}
                      </div>
                    </section>

                    <p className="rounded-md border border-sky-200/80 bg-sky-50 px-3 py-2 text-xs leading-snug text-sky-900">
                      {t('leadMagnet.wizard.reviewPublishHint')}
                    </p>
                  </div>
                </div>
              )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-4 py-4">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              {t('leadMagnet.wizard.previous')}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => saveDraft()}
                disabled={createMut.isPending || updateMut.isPending}
              >
                {t('leadMagnet.wizard.saveDraft')}
              </Button>
              <Button onClick={next} disabled={publishMut.isPending || createMut.isPending}>
                {step === STEP_CONFIG.length - 1 ? t('leadMagnet.wizard.publish') : t('leadMagnet.wizard.next')}
                {step < STEP_CONFIG.length - 1 ? <ArrowRight className="ml-1 h-4 w-4" /> : null}
              </Button>
            </div>
          </div>
        </div>

        <aside className="hidden min-h-0 self-start xl:block">
          <div className="sticky top-4 overflow-hidden">
            <LeadMagnetPhonePreview
              form={form}
              accountLabel={previewAccount.label}
              accountAvatarUrl={previewAccount.avatarUrl}
            />
          </div>
        </aside>
        </div>

        <div
          className="h-2 shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
          aria-hidden
        />
      </div>
    </LeadMagnetPageShell>
  );
}

function PlatformAccountSection({
  platform,
  title,
  enabled,
  accountId,
  accounts,
  loading,
  settingsPath,
  emptyHint,
  scopeHint,
  onEnabledChange,
  onAccountChange,
}: {
  platform: LeadMagnetPlatform;
  title: string;
  enabled: boolean;
  accountId: string;
  accounts: ReturnType<typeof useLeadMagnetMetaAccounts>['igAccounts'];
  loading: boolean;
  settingsPath: string;
  emptyHint: string;
  scopeHint: string;
  onEnabledChange: (checked: boolean) => void;
  onAccountChange: (accountId: string) => void;
}) {
  const { t } = useTranslation();
  const toggleId = `lead-magnet-platform-${platform}`;
  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-background p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={toggleId} className="cursor-pointer select-none text-sm font-medium">
          {title}
        </label>
        <Switch
          id={toggleId}
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>
      {enabled ? (
        loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {emptyHint}{' '}
            <Link to={settingsPath} className="text-primary underline">
              {t('settings.page.title')}
            </Link>
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">{t('leadMagnet.wizard.accountLabel')}</Label>
            <Select value={accountId || undefined} onValueChange={onAccountChange}>
              <SelectTrigger>
                <SelectValue placeholder={t('leadMagnet.wizard.selectAccount')} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((o) => (
                  <SelectItem key={o.id} value={o.id} disabled={o.disabled}>
                    {o.label}
                    {!o.scopesOk ? ` (${scopeHint})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      ) : null}
    </div>
  );
}

function PostPicker({
  platform,
  accountId,
  posts,
  loading,
  selected,
  onToggle,
  selectAccountHint,
}: {
  platform: LeadMagnetPlatform;
  accountId: string;
  posts: LeadMagnetMediaPost[];
  loading: boolean;
  selected: LeadMagnetCampaignForm['posts'];
  onToggle: (
    platform: LeadMagnetPlatform,
    mediaId: string,
    permalink: string | null,
    caption: string | null,
    thumbnailUrl: string | null,
  ) => void;
  selectAccountHint: string;
}) {
  const { t } = useTranslation();
  if (!accountId) {
    return <p className="text-sm text-amber-600">{selectAccountHint}</p>;
  }
  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (posts.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('leadMagnet.wizard.noPostsForAccount')}</p>;
  }
  return (
    <div className="h-full min-h-0 space-y-2 overflow-y-auto">
      {posts.map((p) => {
        const checked = selected.some((x) => x.platform === platform && x.media_id === p.media_id);
        const thumbUrl = (p.thumbnail_url ?? p.media_url)?.trim() || null;
        return (
          <label
            key={p.media_id}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background p-2 shadow-sm transition hover:border-border"
          >
            <Checkbox
              className="mt-1 shrink-0"
              checked={checked}
              onCheckedChange={() => onToggle(
                platform,
                p.media_id,
                p.permalink,
                p.caption,
                thumbUrl,
              )}
            />
            <PostThumbnail url={thumbUrl} mediaType={p.media_type} alt={p.caption ?? p.media_id} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-mono text-xs text-muted-foreground">{p.media_id}</p>
              <p className="line-clamp-2">{p.caption || t('leadMagnet.wizard.noCaption')}</p>
              {p.timestamp ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(p.timestamp).toLocaleDateString()}
                </p>
              ) : null}
            </div>
          </label>
        );
      })}
    </div>
  );
}

function PostThumbnail({
  url,
  mediaType,
  alt,
}: {
  url: string | null;
  mediaType: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(url) && !failed;

  if (showImage) {
    return (
      <img
        src={url!}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-16 w-16 shrink-0 rounded-md border object-cover bg-muted"
      />
    );
  }

  return (
    <div
      className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-md border bg-muted text-muted-foreground"
      aria-hidden
    >
      <ImageIcon className="h-5 w-5" />
      {mediaType ? (
        <span className="mt-0.5 max-w-[3.5rem] truncate text-[9px] uppercase">{mediaType}</span>
      ) : null}
    </div>
  );
}

function BadgeStep({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${
        active ? 'bg-primary text-primary-foreground' : done ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'
      }`}
    >
      {label}
    </span>
  );
}

function WizardFieldSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border/60 bg-background p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ReviewMetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 break-words text-sm text-foreground',
          mono && 'rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[13px]',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ReviewToggleRow({
  label,
  on,
  onLabel,
  offLabel,
  detail,
}: {
  label: string;
  on: boolean;
  onLabel: string;
  offLabel: string;
  detail?: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {detail ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
        ) : null}
      </div>
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
          on
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {on ? onLabel : offLabel}
      </span>
    </li>
  );
}

function WizardSkipOption({
  id,
  checked,
  onCheckedChange,
  label,
  info,
  disabled,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  info: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-muted/20 px-3 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-sm leading-tight">
          {label}
        </label>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
                aria-label={info}
              >
                <CircleHelp className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
              {info}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function WizardInputField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="leading-tight">{label}</Label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="text-xs leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const WIZARD_BUTTON_LABEL_VARIANTS = {
  follow: {
    shell: 'border-sky-200/90 bg-gradient-to-br from-sky-50 to-sky-100/40',
    label: 'text-sky-800',
    badge: 'bg-sky-100 text-sky-700 ring-sky-200',
    input:
      'h-9 w-full min-w-[8rem] max-w-sm cursor-text rounded-full border-sky-400/60 bg-sky-600 text-center text-sm font-semibold text-white shadow-sm transition-shadow placeholder:text-sky-200/80 hover:ring-2 hover:ring-sky-300/70 hover:ring-offset-1 focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:ring-offset-1',
  },
  offer: {
    shell: 'border-violet-200/90 bg-gradient-to-br from-violet-50 to-violet-100/40',
    label: 'text-violet-800',
    badge: 'bg-violet-100 text-violet-700 ring-violet-200',
    input:
      'h-9 w-full min-w-[8rem] max-w-sm cursor-text rounded-full border-violet-400/60 bg-violet-600 text-center text-sm font-semibold text-white shadow-sm transition-shadow placeholder:text-violet-200/80 hover:ring-2 hover:ring-violet-300/70 hover:ring-offset-1 focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-1',
  },
  delivery: {
    shell: 'border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-emerald-100/40',
    label: 'text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    input:
      'h-9 w-full min-w-[8rem] max-w-sm cursor-text rounded-full border-emerald-400/60 bg-emerald-600 text-center text-sm font-semibold text-white shadow-sm transition-shadow placeholder:text-emerald-200/80 hover:ring-2 hover:ring-emerald-300/70 hover:ring-offset-1 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-1',
  },
} as const;

function WizardButtonLabelField({
  variant,
  label,
  value,
  onChange,
  placeholder,
}: {
  variant: keyof typeof WIZARD_BUTTON_LABEL_VARIANTS;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const styles = WIZARD_BUTTON_LABEL_VARIANTS[variant];

  return (
    <div className={cn('rounded-lg border px-3 py-2.5', styles.shell)}>
      <div className="mb-2 flex items-center gap-2">
        <Label className={cn('min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide', styles.label)}>
          {label}
        </Label>
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset',
            styles.badge,
          )}
        >
          {t('leadMagnet.wizard.buttonBadge')}
        </span>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
                aria-label={t('leadMagnet.wizard.buttonLabelHint')}
              >
                <CircleHelp className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
              {t('leadMagnet.wizard.buttonLabelHint')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={styles.input}
      />
    </div>
  );
}

function MessageField({
  label,
  value,
  onChange,
  hint,
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  hideLabel?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {hideLabel ? null : <Label className="leading-tight">{label}</Label>}
      <Textarea
        rows={3}
        className="min-h-[4.5rem] resize-y"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={hideLabel ? label : undefined}
      />
      {hint ? <p className="text-xs leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
