import { useEffect, useState } from "react";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface TimeDisplayProps {
  /** If false, update every 60s (lighter on battery); default true for seconds precision */
  showSeconds?: boolean;
}

export const TimeDisplay = ({ showSeconds = true }: TimeDisplayProps) => {
  const { language } = useAppTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const locale = language === "id" ? "id-ID" : "en-US";
  const intervalMs = showSeconds ? 1000 : 60_000;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      ...(showSeconds ? { second: "2-digit" as const } : {}),
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="text-center py-6 px-4">
      <div className="text-5xl font-bold text-foreground mb-2 font-mono tracking-tight">
        {formatTime(currentTime)}
      </div>
      <div className="text-base text-muted-foreground">
        {formatDate(currentTime)}
      </div>
    </div>
  );
};