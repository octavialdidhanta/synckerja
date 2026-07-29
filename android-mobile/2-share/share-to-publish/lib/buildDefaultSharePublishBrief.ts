import {
  DEFAULT_BRIEF_STORYBOARD_HEADERS,
  DEFAULT_BRIEF_STORYBOARD_ROW_COUNT,
  buildStoryboardTable,
} from "@/6-1-dashboard/modal/briefStoryboardConstants";
import { stringifyMarkdownTable } from "@/6-1-dashboard/utils/markdownTableUtils";

/**
 * Default brief for Share-to-Publish create: storyline hook (title) +
 * canonical empty Timing|Visual|VO storyboard table (same as BriefDialog).
 */
export function buildDefaultSharePublishBrief(title: string): string {
  const storyline = title.trim();
  const table = stringifyMarkdownTable(
    buildStoryboardTable(
      [...DEFAULT_BRIEF_STORYBOARD_HEADERS],
      DEFAULT_BRIEF_STORYBOARD_ROW_COUNT,
    ),
    { trimTrailingEmptyBodyRows: false },
  );
  if (!storyline) return table;
  return `${storyline}\n\n${table}`;
}
