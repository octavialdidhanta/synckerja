import { Card, CardContent } from "@/mobile/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface BillsOverdueCardProps {
  overdue: number;
}

export function BillsOverdueCard({ overdue }: BillsOverdueCardProps) {
  const { t } = useAppTranslation();
  return (
    <Card className="bg-blue-600 text-white border-0 w-full min-w-0 flex-shrink-0 min-h-[7.25rem]">
      <CardContent className="p-3 min-w-0 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium text-blue-100 truncate">
            {t("bills.overdue", "Overdue")}
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-white truncate">{overdue}</div>
      </CardContent>
    </Card>
  );
}
