import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { buttonVariants } from "@/shared/components/ui/button"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay, isToday, isPast, startOfDay } from "date-fns"
import "./CustomDatePicker.css"

export interface CustomDatePickerProps {
  selected?: Date
  onSelect?: (date: Date) => void
  disabled?: (date: Date) => boolean
  className?: string
  showOutsideDays?: boolean
}

const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function CustomDatePicker({
  selected,
  onSelect,
  disabled,
  className,
  showOutsideDays = true,
}: CustomDatePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const startDate = startOfMonth(currentMonth)
  const endDate = endOfMonth(currentMonth)

  // Get all days in the month
  const monthDays = eachDayOfInterval({ start: startDate, end: endDate })
  
  // Get days from previous month to fill the first week
  const firstDayOfWeek = monthStart.getDay()
  const prevMonthDays = []
  if (firstDayOfWeek > 0) {
    const prevMonth = subMonths(currentMonth, 1)
    const prevMonthEnd = endOfMonth(prevMonth)
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      prevMonthDays.push(new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), prevMonthEnd.getDate() - i))
    }
  }

  // Get days from next month to fill the last week
  const lastDayOfWeek = monthEnd.getDay()
  const nextMonthDays = []
  if (lastDayOfWeek < 6) {
    const nextMonth = addMonths(currentMonth, 1)
    for (let i = 1; i <= (6 - lastDayOfWeek); i++) {
      nextMonthDays.push(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), i))
    }
  }

  const allDays = [...prevMonthDays, ...monthDays, ...nextMonthDays]

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const handleDayClick = (day: Date) => {
    if (disabled && disabled(day)) return
    onSelect?.(day)
  }

  return (
    <div
      className={cn(
        "custom-date-picker p-4 bg-card text-card-foreground rounded-lg border border-border shadow-sm mx-auto",
        className,
      )}
      style={{ width: "fit-content", minWidth: "340px" }}
    >
      {/* Header with navigation */}
      <div className="flex justify-center items-center mb-3">
        <button
          type="button"
          onClick={handlePreviousMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "custom-date-picker-nav h-8 w-8 bg-card p-0 border-border hover:bg-muted hover:text-foreground rounded-md flex items-center justify-center mr-2",
          )}
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-base font-semibold text-foreground mx-4">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "custom-date-picker-nav h-8 w-8 bg-card p-0 border-border hover:bg-muted hover:text-foreground rounded-md flex items-center justify-center ml-2",
          )}
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 mb-1 text-center">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-muted-foreground h-6 font-medium text-xs flex items-center justify-center"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0 text-center">
        {allDays.map((day, index) => {
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected = selected && isSameDay(day, selected)
          const isTodayDate = isToday(day)
          const isPastDate = isPast(startOfDay(day)) && !isTodayDate
          const isDisabled = disabled && disabled(day)

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleDayClick(day)}
              disabled={isDisabled}
              className={cn(
                "custom-date-picker-day h-8 w-full p-0 font-medium text-sm flex items-center justify-center border border-transparent",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
                !isCurrentMonth && "text-muted-foreground/50",
                isCurrentMonth && !isPastDate && !isTodayDate && !isSelected && "text-foreground hover:bg-muted",
                isCurrentMonth &&
                  isPastDate &&
                  !isSelected &&
                  "text-muted-foreground bg-muted/60 hover:bg-muted border-border",
                isSelected &&
                  "bg-gradient-to-br from-primary to-brand-blue-deep text-primary-foreground font-semibold shadow-md scale-105 border-transparent hover:from-primary hover:to-brand-blue-deep",
                isTodayDate &&
                  !isSelected &&
                  "bg-accent text-accent-foreground font-semibold border-primary/35 hover:bg-accent/90",
                isDisabled && "text-muted-foreground/40 opacity-50 cursor-not-allowed hover:bg-transparent hover:scale-100",
              )}
            >
              {format(day, "d")}
            </button>
          )
        })}
      </div>
    </div>
  )
}

CustomDatePicker.displayName = "CustomDatePicker"

export { CustomDatePicker }
