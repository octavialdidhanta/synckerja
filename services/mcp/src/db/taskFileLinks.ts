import type { SupabaseClient } from "@supabase/supabase-js";
import { replaceStorageLinksInText, storagePathsInText } from "../../../../src/shared/storage/storageLinks";
import type { TaskDetail } from "./dailyTasks";

const BUCKET = "task-files";
/** Links handed to Claude stay valid long enough to open or download the image in the same session. */
const SIGN_SECONDS = 60 * 60;

/**
 * task-files is private: swap stored image links in a task's descriptions for signed links.
 * Callers have already checked that the task belongs to the session's organization (mcp_get_task).
 * On any signing failure the stored links are returned unchanged.
 */
export async function signTaskFileLinks(admin: SupabaseClient, task: TaskDetail): Promise<TaskDetail> {
  const texts = [task.description, ...task.steps.map((step) => step.description)];
  const paths = [...new Set(texts.flatMap((text) => storagePathsInText(text, BUCKET)))];
  if (paths.length === 0) return task;
  let signed = new Map<string, string>();
  try {
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrls(paths, SIGN_SECONDS);
    if (error || !data) return task;
    signed = new Map(
      data
        .filter((row) => row.path && row.signedUrl)
        .map((row) => [row.path as string, row.signedUrl as string]),
    );
  } catch {
    return task;
  }
  const swap = (text: string | null) => (text ? replaceStorageLinksInText(text, BUCKET, signed) : text);
  return {
    ...task,
    description: swap(task.description),
    steps: task.steps.map((step) => ({ ...step, description: swap(step.description) })),
  };
}
