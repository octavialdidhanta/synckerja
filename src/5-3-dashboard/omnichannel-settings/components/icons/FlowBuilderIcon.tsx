import type { LucideProps } from "lucide-react";

/** Flowchart / branch icon for omnichannel Flow Builder settings. */
export function FlowBuilderIcon({ className, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      <rect x="7" y="3" width="10" height="4" rx="2" />
      <path d="M12 7v3" />
      <path d="M6 10c0 1 0 2 0 3v3" />
      <path d="M12 10v6" />
      <path d="M18 10c0 1 0 2 0 3v3" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="12" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}
