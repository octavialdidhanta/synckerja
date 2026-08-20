import { format } from "date-fns";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  groupPoHistoryByDate,
  poEventActionKey,
  poEventDefaultAction,
} from "../lib/poHistoryFormat";
import type { PurchaseOrderEvent } from "../types";

export function PoHistoryLog({ events }: { events: PurchaseOrderEvent[] }) {
  const { t } = useAppTranslation();

  const groups = groupPoHistoryByDate(events, {
    today: t("operations.inventory.purchaseOrders.history.today", "Today"),
    yesterday: t("operations.inventory.purchaseOrders.history.yesterday", "Yesterday"),
  });

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">
        {t("operations.inventory.purchaseOrders.historyLog", "History Log")}
      </h3>
      {groups.map((group) => (
        <div key={group.dateKey} className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">{group.label}</div>
          <ul className="space-y-3">
            {group.events.map((event) => (
              <li key={event.id} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="tabular-nums text-muted-foreground">
                    {format(new Date(event.occurredAt), "HH:mm")}
                  </span>
                  <span>
                    <span className="font-medium">{event.actorName}</span>{" "}
                    {t(poEventActionKey(event.eventType), poEventDefaultAction(event.eventType))}
                  </span>
                </div>
                {event.comment ? (
                  <div className="mt-1 pl-4 text-xs text-muted-foreground">&quot;{event.comment}&quot;</div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
