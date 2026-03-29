import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/shared/lib/utils"
import { buttonVariants } from "@/shared/components/ui/button"
import { format } from "date-fns"
import "./EnhancedCalendar.css"

export type EnhancedCalendarProps = React.ComponentProps<typeof DayPicker>

function EnhancedCalendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: EnhancedCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      month={currentMonth}
      onMonthChange={setCurrentMonth}
      className={cn("p-4 pointer-events-auto bg-white rounded-lg shadow-md border border-gray-200", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-3 sm:space-x-3 sm:space-y-0",
        month: "space-y-3",
        caption: "flex justify-center items-center mb-3",
        caption_label: "text-base font-semibold text-gray-800 mx-4",
        nav: "flex items-center justify-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-white p-0 hover:bg-gray-50 transition-all duration-200 border-gray-200 hover:border-gray-300 rounded-md shadow-sm"
        ),
        nav_button_previous: "mr-2",
        nav_button_next: "ml-2",
        table: "w-full border-collapse",
        head_row: "flex justify-between mb-1",
        head_cell: "text-gray-500 w-8 h-6 font-medium text-xs flex items-center justify-center",
        row: "flex justify-between mb-0.5",
        cell: cn(
          "w-8 h-8 text-center text-sm p-0 relative flex items-center justify-center rounded-md",
          "hover:bg-gray-50 transition-all duration-200",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "[&:has([aria-selected].day-outside)]:bg-blue-50/50",
          "[&:has([aria-selected])]:bg-blue-50",
          "first:[&:has([aria-selected])]:rounded-l-md",
          "last:[&:has([aria-selected])]:rounded-r-md",
          "focus-within:relative focus-within:z-20"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 font-medium aria-selected:opacity-100 text-sm hover:bg-gray-100 rounded-md transition-all duration-200 border-0 text-black"
        ),
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700",
          "focus:from-blue-600 focus:to-blue-700",
          "font-semibold shadow-md transform scale-105"
        ),
        day_today: cn(
          "bg-blue-50 text-blue-700 font-bold border border-blue-300",
          "hover:bg-blue-100 hover:border-blue-400"
        ),
        day_outside: "day-outside text-gray-400 opacity-50 aria-selected:bg-blue-50/50 aria-selected:text-gray-400 aria-selected:opacity-40",
        day_disabled: "text-gray-300 opacity-40 cursor-not-allowed",
        day_range_middle: "aria-selected:bg-blue-100 aria-selected:text-blue-900",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ ...props }) => 
          props.orientation === 'left' 
            ? <ChevronLeft className="h-4 w-4 text-gray-600" /> 
            : <ChevronRight className="h-4 w-4 text-gray-600" />,
      }}
      {...props}
    />
  )
}

EnhancedCalendar.displayName = "EnhancedCalendar"

export { EnhancedCalendar }

