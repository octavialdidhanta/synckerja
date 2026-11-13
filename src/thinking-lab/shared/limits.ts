export const TARGET_GENERATE_VALID = 3;

export const ACTIVE_SET_CAP = 6;

export const MAX_GENERATE_ROUNDS = 2;

/**
 * Rewrites one Big Thought fix click may try. Each try is a rewrite plus its checks
 * (about 8 model calls); 8 tries spent over 60 calls and still failed.
 */
export const BT_FIX_MAX_ATTEMPTS = 3;

/** A fix stops early when the same check fails this many tries in a row: the lessons are not moving it. */
export const BT_FIX_SAME_GATE_STOP = 2;

/**
 * Failed rewrites of one Big Thought (kept as fix lessons) after which Fix is closed.
 * The card then offers a fresh rewrite of the reason or deleting it.
 */
export const BT_FIX_STUCK_LESSONS = 6;

/** Failures of the same kind check after which a fix writes a new reason instead of patching the old one. */
export const BT_FIX_REPLACE_AFTER = 2;

/** Thinking Lab checks run at the same time during an audit (per organization AI key). */
export const THINKING_PARALLEL_CHECKS = 3;
