import React, { useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { useHabitTracker } from "../context/HabitTrackerContext";

export const HabitCalendar = () => {
  const { entries } = useHabitTracker();
  const [currentDate, setCurrentDate] = useState(new Date());
  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold"><Calendar className="h-5 w-5" />Calendar View</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[100px] text-center text-sm font-medium">{format(currentDate, "MMMM yyyy")}</span>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="seamless-scroll flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const hasEntry = entries.some((e) => e.entry_date === format(d, "yyyy-MM-dd"));
            return <div key={d.toISOString()} className={`aspect-square rounded border p-1 text-xs ${hasEntry ? "border-green-200 bg-green-50" : "border-gray-200"}`}>{format(d, "d")}</div>;
          })}
        </div>
      </CardContent>
    </Card>
  );
};
