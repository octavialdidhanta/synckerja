export const LEAD_MAGNET_BASE_PATH = '/digital-marketing/lead-magnet';

export const LEAD_MAGNET_PATHS = {
  list: '/digital-marketing/lead-magnet',
  new: '/digital-marketing/lead-magnet/new',
  action: '/digital-marketing/lead-magnet/action',
  download: '/digital-marketing/lead-magnet/download',
  edit: (id: string) => `/digital-marketing/lead-magnet/${id}/edit`,
  analytics: (id: string) => `/digital-marketing/lead-magnet/${id}/analytics`,
  omnichannelSettings: '/omnichannel/settings/lead-magnet',
} as const;

export const LEAD_MAGNET_FUNNEL_STEPS = [
  { key: 'comment_matched', label: 'Komentar match' },
  { key: 'comment_replied', label: 'Balas komentar' },
  { key: 'follow_gate_sent', label: 'DM follow gate' },
  { key: 'follow_validated', label: 'Follow valid' },
  { key: 'framework_offered', label: 'Material offer' },
  { key: 'material_offer_skipped', label: 'Material offer skipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'dm_failed', label: 'DM gagal' },
] as const;
