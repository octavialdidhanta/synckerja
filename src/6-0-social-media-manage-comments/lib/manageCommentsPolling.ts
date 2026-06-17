/** Background poll while Manage Comments inbox is open (tab focused). */
export const MANAGE_COMMENTS_THREAD_POLL_MS = 2_000;
export const MANAGE_COMMENTS_POSTS_POLL_MS = 10_000;

/** YouTube: slower polls + server cache (Google API quota). */
export const YOUTUBE_MANAGE_COMMENTS_THREAD_POLL_MS = 10_000;
export const YOUTUBE_MANAGE_COMMENTS_POSTS_POLL_MS = 30_000;

/** After posting a reply, poll faster until TikTok returns the new reply. */
export const MANAGE_COMMENTS_BURST_POLL_MS = 1_000;
export const MANAGE_COMMENTS_BURST_MAX_ATTEMPTS = 20;
