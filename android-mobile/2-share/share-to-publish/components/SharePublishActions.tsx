import { Button } from "@/mobile-app/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  attachBusy: boolean;
  publishBusy: boolean;
  /** Spinner only on the clicked action; both stay disabled while publishBusy. */
  activeAction?: "schedule" | "post_now" | null;
  /** After all platforms OK — disable both to prevent double upload. */
  actionsLocked?: boolean;
  eligible: boolean;
  attached: boolean;
  onAttach: () => void;
  onSchedule: () => void;
  onPostNow: () => void;
};

export function SharePublishActions({
  attachBusy,
  publishBusy,
  activeAction = null,
  actionsLocked = false,
  eligible,
  attached,
  onAttach,
  onSchedule,
  onPostNow,
}: Props) {
  const { t } = useAppTranslation();
  const publishDisabled = publishBusy || actionsLocked || !eligible;

  return (
    <div className="flex flex-col gap-2">
      {!attached ? (
        <Button type="button" className="w-full" disabled={attachBusy} onClick={onAttach}>
          {attachBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("share.publish.actions.saveToPlan", "Save video to plan")}
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={publishDisabled}
            onClick={onSchedule}
          >
            {publishBusy && activeAction === "schedule" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("share.publish.actions.schedule", "Schedule")}
          </Button>
          <Button type="button" disabled={publishDisabled} onClick={onPostNow}>
            {publishBusy && activeAction === "post_now" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("share.publish.actions.postNow", "Post now")}
          </Button>
        </div>
      )}
    </div>
  );
}
