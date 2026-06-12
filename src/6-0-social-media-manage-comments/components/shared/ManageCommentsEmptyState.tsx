import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

type ManageCommentsEmptyStateProps = {
  title?: string;
  description?: string;
};

export function ManageCommentsEmptyState({
  title,
  description,
}: ManageCommentsEmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <MessageSquare className="mb-3 h-10 w-10 text-gray-300" aria-hidden />
      <p className="text-sm font-medium text-gray-900">
        {title ??
          t("digitalMarketing.manageComments.selectPostTitle", "Select a post")}
      </p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        {description ??
          t(
            "digitalMarketing.manageComments.selectPostDesc",
            "Choose a video from the list to view and manage comments.",
          )}
      </p>
    </div>
  );
}

ManageCommentsEmptyState.displayName = "ManageCommentsEmptyState";
