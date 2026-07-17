import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { LeadMagnetDeliveryStep } from '../components/LeadMagnetDeliveryStep';
import { updateLeadMagnetCampaign } from '../lib/leadMagnetApi';
import { parseLeadMagnetDeliveryMode, validateLeadMagnetDeliveryForm } from '../lib/leadMagnetDeliveryAsset';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

const STEPS = ['Dasar', 'Post', 'Keyword', 'Pesan', 'Delivery', 'Review'] as const;

function campaignToForm(c: LeadMagnetCampaign): LeadMagnetCampaignForm {
  const accounts = getCampaignAccounts(c);
  const posts = (c.lead_magnet_campaign_posts ?? []).map((p) => ({
    platform: p.platform ?? (accounts[0]?.platform ?? 'instagram'),
    media_id: p.media_id,
    media_permalink: p.media_permalink,
    media_caption: p.media_caption ?? null,
    media_thumbnail_url: p.media_thumbnail_url ?? null,
  }));
  return {
    name: c.name,
    accounts,
    keyword: c.keyword,
    comment_reply_text: c.comment_reply_text,
    follow_gate_text: c.follow_gate_text,
    follow_button_label: c.follow_button_label,
    framework_offer_text: c.framework_offer_text,
    framework_button_label: c.framework_button_label,
    delivery_text: c.delivery_text,
    delivery_button_label: c.delivery_button_label,
    delivery_url: c.delivery_url,
    delivery_mode: parseLeadMagnetDeliveryMode(c.delivery_mode),
    delivery_storage_path: c.delivery_storage_path ?? null,
    delivery_file_name: c.delivery_file_name ?? null,
    delivery_file_mime: c.delivery_file_mime ?? null,
    delivery_file_size_bytes: c.delivery_file_size_bytes ?? null,
    skip_follow_gate_if_follower: c.skip_follow_gate_if_follower,
    skip_material_offer: c.skip_material_offer ?? false,
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

  const createMut = useCreateLeadMagnetCampaign();
  const updateMut = useUpdateLeadMagnetCampaign(effectiveCampaignId ?? '');
  const publishMut = usePublishLeadMagnetCampaign();

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
    if (stepIndex === 2 && !form.keyword.trim()) {
      return t('leadMagnet.wizard.validation.keywordRequired');
    }
    if (stepIndex === 4) {
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

  const handlePublish = async () => {
    const err = validateStep(0) ?? validateStep(1) ?? validateStep(2) ?? validateStep(4);
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
    if (step === STEPS.length - 1) {
      await handlePublish();
      return;
    }
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const accountLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of [...igAccounts, ...fbAccounts]) map.set(a.id, a.label);
    return map;
  }, [igAccounts, fbAccounts]);

  if (isEdit && loadingExisting) {
    return null;
  }

  return (
    <LeadMagnetPageShell>
      <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(LEAD_MAGNET_PATHS.list)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('leadMagnet.wizard.back')}
          </Button>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {STEPS.map((label, i) => (
              <BadgeStep key={label} active={i === step} done={i < step} label={label} />
            ))}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-background shadow-sm">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {step === 0 && (
                <div className="space-y-5">
                  <WizardInputField
                    label={t('leadMagnet.wizard.campaignName')}
                    value={form.name}
                    onChange={(v) => patch({ name: v })}
                  />

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
              )}

              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t('leadMagnet.wizard.postStepHint', { count: form.posts.length })}
                  </p>
                  {!igEnabled && !fbEnabled ? (
                    <p className="text-sm text-amber-600">{t('leadMagnet.wizard.selectPlatformFirst')}</p>
                  ) : igEnabled && fbEnabled ? (
                    <Tabs defaultValue="instagram">
                      <TabsList className="mb-2">
                        <TabsTrigger value="instagram">
                          Instagram ({countPostsForPlatform(form.posts, 'instagram')})
                        </TabsTrigger>
                        <TabsTrigger value="facebook">
                          Facebook ({countPostsForPlatform(form.posts, 'facebook')})
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="instagram">
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
                      <TabsContent value="facebook">
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
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-1.5">
                  <WizardInputField
                    label={t('leadMagnet.wizard.keywordLabel')}
                    value={form.keyword}
                    onChange={(v) => patch({ keyword: v })}
                    placeholder={t('leadMagnet.wizard.keywordPlaceholder')}
                    hint={t('leadMagnet.wizard.keywordHint')}
                  />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <MessageField
                    label={t('leadMagnet.wizard.commentReply')}
                    value={form.comment_reply_text}
                    onChange={(v) => patch({ comment_reply_text: v })}
                  />

                  <WizardFieldSection title={t('leadMagnet.wizard.followGate')}>
                    <WizardSkipOption
                      id="skip-follow-gate"
                      checked={form.skip_follow_gate_if_follower}
                      onCheckedChange={(checked) => patch({ skip_follow_gate_if_follower: checked })}
                      label={t('leadMagnet.wizard.skipFollowGate')}
                      info={t('leadMagnet.wizard.skipFollowGateHint')}
                    />
                    <div
                      className={
                        form.skip_follow_gate_if_follower
                          ? 'pointer-events-none space-y-3 opacity-50'
                          : 'space-y-3'
                      }
                    >
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
                  </WizardFieldSection>

                  <WizardFieldSection title={t('leadMagnet.wizard.frameworkOffer')}>
                    <WizardSkipOption
                      id="skip-material-offer"
                      checked={form.skip_material_offer}
                      onCheckedChange={(checked) => patch({ skip_material_offer: checked })}
                      label={t('leadMagnet.wizard.skipMaterialOffer')}
                      info={t('leadMagnet.wizard.skipMaterialOfferHint')}
                    />
                    <div
                      className={form.skip_material_offer ? 'pointer-events-none space-y-3 opacity-50' : 'space-y-3'}
                    >
                      <MessageField
                        label={t('leadMagnet.wizard.frameworkOffer')}
                        value={form.framework_offer_text}
                        onChange={(v) => patch({ framework_offer_text: v })}
                        hint={t('leadMagnet.wizard.usernameHint')}
                        hideLabel
                      />
                      <WizardButtonLabelField
                        variant="offer"
                        label={t('leadMagnet.wizard.frameworkButtonLabel')}
                        value={form.framework_button_label}
                        onChange={(v) => patch({ framework_button_label: v })}
                      />
                    </div>
                  </WizardFieldSection>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5">
                  <MessageField
                    label={t('leadMagnet.wizard.deliveryMessage')}
                    value={form.delivery_text}
                    onChange={(v) => patch({ delivery_text: v })}
                  />
                  <WizardButtonLabelField
                    variant="delivery"
                    label={t('leadMagnet.wizard.deliveryButtonLabel')}
                    value={form.delivery_button_label}
                    onChange={(v) => patch({ delivery_button_label: v })}
                  />
                  <LeadMagnetDeliveryStep
                    form={form}
                    onPatch={patch}
                    organizationId={organizationId}
                    campaignId={effectiveCampaignId}
                    ensureCampaignId={saveDraft}
                    onPersistAfterUpload={persistFormSnapshot}
                  />
                </div>
              )}

              {step === 5 && (
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>{form.name}</strong> · keyword <code>{form.keyword}</code>
                  </p>
                  <ul className="list-inside list-disc text-muted-foreground">
                    {igEnabled ? (
                      <li>
                        Instagram: {accountLabelById.get(igAccountId) ?? igAccountId} ·{' '}
                        {countPostsForPlatform(form.posts, 'instagram')} post
                      </li>
                    ) : null}
                    {fbEnabled ? (
                      <li>
                        Facebook: {accountLabelById.get(fbAccountId) ?? fbAccountId} ·{' '}
                        {countPostsForPlatform(form.posts, 'facebook')} post
                      </li>
                    ) : null}
                  </ul>
                  <p className="text-muted-foreground">
                    {t('leadMagnet.wizard.reviewSkipMaterialOffer', {
                      enabled: form.skip_material_offer
                        ? t('leadMagnet.wizard.reviewOn')
                        : t('leadMagnet.wizard.reviewOff'),
                    })}
                  </p>
                  <p className="text-muted-foreground">
                    {form.delivery_mode === 'upload'
                      ? t('leadMagnet.wizard.reviewDeliveryUpload', {
                          file: form.delivery_file_name ?? '—',
                        })
                      : t('leadMagnet.wizard.reviewDeliveryLink', {
                          url: form.delivery_url || '—',
                        })}
                  </p>
                  <p className="text-muted-foreground">{t('leadMagnet.wizard.reviewPublishHint')}</p>
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
                {step === STEPS.length - 1 ? t('leadMagnet.wizard.publish') : t('leadMagnet.wizard.next')}
                {step < STEPS.length - 1 ? <ArrowRight className="ml-1 h-4 w-4" /> : null}
              </Button>
            </div>
          </div>
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
  const toggleId = `lead-magnet-platform-${platform}`;
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          id={toggleId}
          checked={enabled}
          onCheckedChange={(c) => onEnabledChange(c === true)}
        />
        <label htmlFor={toggleId} className="cursor-pointer select-none">
          {title}
        </label>
      </div>
      {enabled ? (
        loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {emptyHint}{' '}
            <Link to={settingsPath} className="text-primary underline">
              Settings
            </Link>
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Akun</Label>
            <Select value={accountId || undefined} onValueChange={onAccountChange}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih akun" />
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
  if (!accountId) {
    return <p className="text-sm text-amber-600">{selectAccountHint}</p>;
  }
  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (posts.length === 0) {
    return <p className="text-sm text-muted-foreground">Tidak ada post ditemukan untuk akun ini.</p>;
  }
  return (
    <div className="max-h-96 space-y-2 overflow-y-auto">
      {posts.map((p) => {
        const checked = selected.some((x) => x.platform === platform && x.media_id === p.media_id);
        const thumbUrl = (p.thumbnail_url ?? p.media_url)?.trim() || null;
        return (
          <label
            key={p.media_id}
            className="flex cursor-pointer items-start gap-3 rounded border p-2 hover:bg-muted/40"
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
              <p className="line-clamp-2">{p.caption || '(tanpa caption)'}</p>
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
    <section className="space-y-3 rounded-md border border-border/50 bg-muted/15 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function WizardSkipOption({
  id,
  checked,
  onCheckedChange,
  label,
  info,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  info: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onCheckedChange(c === true)} />
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
        <Label className={cn('text-xs font-semibold uppercase tracking-wide', styles.label)}>{label}</Label>
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset',
            styles.badge,
          )}
        >
          {t('leadMagnet.wizard.buttonBadge')}
        </span>
      </div>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={styles.input}
      />
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{t('leadMagnet.wizard.buttonLabelHint')}</p>
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
