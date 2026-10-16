export const THINKING_LAB_BRIEF_MARK = "<!-- thinking-lab-vo -->";

export function isThinkingLabBrief(value: string): boolean {
  return value.includes(THINKING_LAB_BRIEF_MARK);
}
