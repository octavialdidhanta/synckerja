import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { buttonVariants } from "@/shared/components/ui/button"
import { format, addMonths, subMonths, startOfMonth, isSameMonth } from "date-fns"
import { id as idLocale } from "date-fns/locale"

export interface MonthPickerProps {
  selected?: Date | null
  onSelect?: (date: Date) => void
  className?: string
  disabled?: boolean
  /** Tampilan ringkas: padding dan tombol lebih kecil (untuk drawer/modal). */
  compact?: boolean
}

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

function MonthPicker({
  selected,
  onSelect,
  className,
  disabled = false,
  compact = false,
}: MonthPickerProps) {
  const [currentYear, setCurrentYear] = React.useState(new Date().getFullYear())
  const [viewingMonth, setViewingMonth] = React.useState(new Date())

  // Initialize viewing month from selected date if available
  React.useEffect(() => {
    if (selected) {
      setViewingMonth(selected)
      setCurrentYear(selected.getFullYear())
    }
  }, [selected])

  const handlePreviousYear = () => {
    setCurrentYear(currentYear - 1)
    setViewingMonth(new Date(currentYear - 1, viewingMonth.getMonth(), 1))
  }

  const handleNextYear = () => {
    setCurrentYear(currentYear + 1)
    setViewingMonth(new Date(currentYear + 1, viewingMonth.getMonth(), 1))
  }

  const handleMonthClick = (monthIndex: number) => {
    if (disabled) return
    const selectedDate = startOfMonth(new Date(currentYear, monthIndex, 1))
    setViewingMonth(selectedDate)
    // Panggil onSelect segera agar filter terapkan; hindari event tertahan oleh parent (drawer/scroll)
    if (onSelect) {
      onSelect(selectedDate)
    }
  }

  return (
    <div
      className={cn(
        "month-picker w-full min-w-0 bg-white rounded-lg shadow-sm border border-gray-200",
        compact ? "p-3 mx-0 max-w-none" : "max-w-[320px] sm:max-w-none sm:w-auto sm:min-w-[320px] p-2 sm:p-4 mx-auto",
        className
      )}
    >
      {/* Header with year navigation */}
      <div className={cn("flex justify-center items-center", compact ? "mb-3" : "mb-2 sm:mb-4")}>
        <button
          type="button"
          onClick={handlePreviousYear}
          disabled={disabled}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-8 w-8 bg-white p-0 hover:bg-gray-50 transition-all duration-200 border-gray-200 hover:border-gray-300 rounded-md shadow-sm flex items-center justify-center mr-1 sm:mr-2",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <ChevronLeft className="h-4 w-4 text-gray-700" />
        </button>
        <span className={cn("font-semibold text-gray-800 text-center", compact ? "text-sm mx-2 min-w-[56px]" : "text-base sm:text-lg mx-2 sm:mx-4 min-w-[64px] sm:min-w-[80px]")}>
          {currentYear}
        </span>
        <button
          type="button"
          onClick={handleNextYear}
          disabled={disabled}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-8 w-8 bg-white p-0 hover:bg-gray-50 transition-all duration-200 border-gray-200 hover:border-gray-300 rounded-md shadow-sm flex items-center justify-center ml-1 sm:ml-2",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <ChevronRight className="h-4 w-4 text-gray-700" />
        </button>
      </div>

      {/* Months grid - compact on small screens to avoid scroll */}
      <div className={cn("grid grid-cols-3", compact ? "gap-2" : "gap-1.5 sm:gap-2")}>
        {months.map((monthName, monthIndex) => {
          const monthDate = new Date(currentYear, monthIndex, 1)
          const isSelected = selected && isSameMonth(monthDate, selected)
          const isCurrentMonth = isSameMonth(monthDate, new Date())

          return (
            <button
              key={monthIndex}
              type="button"
              onClick={() => handleMonthClick(monthIndex)}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={disabled}
              className={cn(
                "font-medium rounded-md transition-all duration-200 border touch-manipulation",
                "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
                compact ? "h-10 min-h-[44px] px-2 py-2 text-xs" : "h-9 sm:h-12 min-h-[44px] sm:min-h-0 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm",
                // Default styling
                !isSelected && !isCurrentMonth && "border-gray-200 text-gray-700 bg-white",
                // Current month styling (not selected)
                isCurrentMonth && !isSelected && "border-blue-300 text-blue-700 bg-blue-50",
                // Selected month styling
                isSelected && "bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-600 font-semibold shadow-md",
                // Disabled styling
                disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
              )}
            >
              {monthName}
            </button>
          )
        })}
      </div>
    </div>
  )
}

MonthPicker.displayName = "MonthPicker"

export { MonthPicker }

