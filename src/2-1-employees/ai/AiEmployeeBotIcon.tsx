import { cn } from "@/shared/lib/utils";

/** Line-art robot head matching the AI Employee Fokus angle control. */
export function AiEmployeeBotIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-3.5 w-3.5", className)}
      aria-hidden
    >
      <path
        d="M12 3.5v2M8 5.5h8a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 16 17.5H8A2.5 2.5 0 0 1 5.5 15v-7A2.5 2.5 0 0 1 8 5.5ZM4.5 11.5H5.5M18.5 11.5H19.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 10.25v2.5M14 10.25v2.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
