import type { RecipeDraftNotice } from "../types";

type T = (key: string, fallback?: string, vars?: Record<string, string | number>) => string;

export type NoticeTone = "warning" | "info" | "blocking";

export type NoticeText = { tone: NoticeTone; title: string; body: string };

function list(items: string[] | undefined): string {
  return (items ?? []).join(", ");
}

/** Plain-language title and explanation for one warning or blocking item. */
export function noticeText(t: T, notice: RecipeDraftNotice): NoticeText {
  const items = list(notice.items);
  switch (notice.code) {
    case "missing_cost":
      return {
        tone: "warning",
        title: t("recipeDrafts.notice.missingCostTitle", "{{items}} has no buy cost yet", { items }),
        body: t(
          "recipeDrafts.notice.missingCostBody",
          "Counted as Rp0, so the real HPP is a little higher. Set the buy cost in Library or record a Purchase Order.",
        ),
      };
    case "unusual_quantity":
      return {
        tone: "warning",
        title: t("recipeDrafts.notice.unusualTitle", "Unusual quantity: {{items}}", { items }),
        body: t(
          "recipeDrafts.notice.unusualBody",
          "Check the unit again. Mixing up g and kg makes stock and HPP far off.",
        ),
      };
    case "removed_ingredient":
      return {
        tone: "info",
        title: t("recipeDrafts.notice.removedTitle", "{{items}} removed from the recipe", { items }),
        body: t(
          "recipeDrafts.notice.removedBody",
          "After publishing, its stock no longer goes down when this menu is sold.",
        ),
      };
    case "hpp_change":
      return {
        tone: "warning",
        title: t("recipeDrafts.notice.hppChangeTitle", "HPP changes by {{percent}}%", {
          percent: Math.abs(notice.percent ?? 0).toLocaleString("id-ID"),
        }),
        body: t("recipeDrafts.notice.hppChangeBody", "A change above 20% is worth a second look before publishing."),
      };
    case "stale":
      return {
        tone: "blocking",
        title: t("recipeDrafts.notice.staleTitle", "The recipe changed after this draft was made"),
        body: t(
          "recipeDrafts.notice.staleBody",
          "Publishing would overwrite that change. Ask Claude to prepare the draft again from the current recipe.",
        ),
      };
    case "deleted_ingredient":
      return {
        tone: "blocking",
        title: t("recipeDrafts.notice.deletedTitle", "Deleted ingredient: {{items}}", { items }),
        body: t("recipeDrafts.notice.deletedBody", "Remove it from the draft, or ask Claude for a new draft."),
      };
    case "empty":
      return {
        tone: "blocking",
        title: t("recipeDrafts.notice.emptyTitle", "The draft has no ingredients"),
        body: t("recipeDrafts.notice.emptyBody", "Add at least one ingredient, or reject the draft."),
      };
    case "not_pending":
      return {
        tone: "blocking",
        title: t("recipeDrafts.notice.notPendingTitle", "This draft is closed"),
        body: notice.status === "expired"
          ? t("recipeDrafts.notice.expiredBody", "It expired after 14 days without a decision.")
          : t("recipeDrafts.notice.closedBody", "It was already published, rejected, or replaced by a newer draft."),
      };
    default:
      return { tone: "warning", title: notice.code, body: "" };
  }
}

/** Map a server refusal to a sentence a person can act on. */
export function draftErrorMessage(t: T, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("recipe_draft_blocked") && message.includes("stale")) {
    return t("recipeDrafts.error.stale", "The recipe changed after this draft was made. Ask Claude for a new draft.");
  }
  if (message.includes("recipe_draft_blocked")) {
    return t("recipeDrafts.error.blocked", "This draft cannot be published. Check the red notice above.");
  }
  if (message.includes("recipe_draft_confirmation_required")) {
    return t("recipeDrafts.error.confirm", "Tick the confirmation box after checking the notices.");
  }
  if (message.includes("recipe_draft_not_pending")) {
    return t("recipeDrafts.error.notPending", "This draft is already closed.");
  }
  if (message.includes("recipe_draft_quantity_too_small")) {
    return t("recipeDrafts.error.tooSmall", "A quantity is too small for its unit. Use a smaller unit in Library or a larger amount.");
  }
  if (message.includes("recipe_draft_duplicate_ingredient")) {
    return t("recipeDrafts.error.duplicate", "An ingredient appears twice.");
  }
  if (message.includes("forbidden")) {
    return t("recipeDrafts.error.forbidden", "Only the owner or an admin can do this.");
  }
  return t("recipeDrafts.error.generic", "Could not save. Please try again.");
}
