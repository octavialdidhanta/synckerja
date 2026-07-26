/** Max pose photos per digital asset character. */
export const MAX_CHARACTER_POSE_IMAGES = 12;

export const CHARACTER_POSE_PRESET_KEYS = [
  'front_closeup',
  'face_left',
  'face_right',
  'looking_down',
  'looking_up',
  'sitting',
  'from_behind',
  'laughing',
  'neutral',
  'full_body',
  'custom',
] as const;

export type CharacterPoseKey = (typeof CHARACTER_POSE_PRESET_KEYS)[number];

export function isCharacterPoseKey(value: string): value is CharacterPoseKey {
  return (CHARACTER_POSE_PRESET_KEYS as readonly string[]).includes(value);
}

/** i18n key for a preset pose (custom uses label_custom instead). */
export function characterPoseLabelKey(poseKey: CharacterPoseKey): string {
  return `digitalAssets.pose.${poseKey}`;
}

export const CHARACTER_POSE_I18N_FALLBACKS: Record<CharacterPoseKey, string> = {
  front_closeup: 'Front close-up',
  face_left: 'Facing left',
  face_right: 'Facing right',
  looking_down: 'Looking down',
  looking_up: 'Looking up',
  sitting: 'Sitting',
  from_behind: 'From behind',
  laughing: 'Laughing',
  neutral: 'Neutral / still',
  full_body: 'Full body',
  custom: 'Custom',
};
