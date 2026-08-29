import { format } from "date-fns";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  buildTransferTimeline,
  groupTransferTimelineByDate,
  transferEventActionKey,
  transferEventDefaultAction,
  transferMovementActionKey,
  transferMovementDefaultAction,
} from "../lib/transferHistoryFormat";
import type { StockTransferEvent, StockTransferMovement } from "../types";

export function TransferHistoryLog({
  events = [],
  movements,
}: {
  events?: StockTransferEvent[];
  movements: StockTransferMovement[];
}) {
  const { t } = useAppTranslation();

  const timeline = buildTransferTimeline(events, movements);
  const groups = groupTransferTimelineByDate(timeline, {
    today: t("operations.inventory.transfer.history.today", "Today"),
    yesterday: t("operations.inventory.transfer.history.yesterday", "Yesterday"),
  });

  if (timeline.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("operations.inventory.transfer.noHistory", "No stock movements recorded.")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">
        {t("operations.inventory.transfer.historyLog", "History Log")}
      </h3>
      {groups.map((group) => (
        <div key={group.dateKey} className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">{group.label}</div>
          <ul className="space-y-3">
            {group.entries.map((entry) =>
              entry.kind === "event" ? (
                <li key={entry.id} className="text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="tabular-nums text-muted-foreground">
                      {format(new Date(entry.occurredAt), "HH:mm")}
                    </span>
                    <span className="font-medium">{entry.actorName}</span>
                    <span>
                      {t(
                        transferEventActionKey(entry.eventType),
                        transferEventDefaultAction(entry.eventType),
                      )}
                    </span>
                  </div>
                  {entry.comment ? (
                    <div className="mt-1 pl-4 text-xs text-muted-foreground">&quot;{entry.comment}&quot;</div>
                  ) : null}
                </li>
              ) : (
                <li key={entry.id} className="text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="tabular-nums text-muted-foreground">
                      {format(new Date(entry.movement.occurredAt), "HH:mm")}
                    </span>
                    <span className="font-medium">{entry.movement.actorName}</span>
                    <span>
                      {t(
                        transferMovementActionKey(entry.movement.direction),
                        transferMovementDefaultAction(entry.movement.direction),
                        {
                          outlet: entry.movement.outletName,
                        },
                      )}
                    </span>
                    <span className="tabular-nums">
                      {entry.movement.qtyDelta > 0 ? "+" : ""}
                      {entry.movement.qtyDelta}
                    </span>
                    <span className="text-muted-foreground">
                      ({t("operations.inventory.transfer.qtyAfter", "after")} {entry.movement.qtyAfter})
                    </span>
                  </div>
                  {entry.movement.note ? (
                    <div className="mt-1 pl-4 text-xs text-muted-foreground">
                      &quot;{entry.movement.note}&quot;
                    </div>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}
