import * as React from "react"
import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip"
import { cn } from "@/shared/lib/utils"

interface InfoTooltipProps {
  content: React.ReactNode
  className?: string
  iconClassName?: string
}

export function InfoTooltip({ content, className, iconClassName }: InfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted hover:bg-muted/80 transition-colors",
              className
            )}
          >
            <Info className={cn("h-3 w-3 text-muted-foreground", iconClassName)} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-sm">{content}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
