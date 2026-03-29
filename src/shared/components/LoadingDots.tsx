interface LoadingDotsProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingDots({ className = "", size = "md" }: LoadingDotsProps) {
  const sizeClasses = {
    sm: "w-1 h-1",
    md: "w-1.5 h-1.5",
    lg: "w-2 h-2",
  };

  return (
    <>
      <style>{`
        @keyframes loading-dots {
          0%, 20% { transform: scale(0.8); opacity: 0.4; }
          50% { transform: scale(1.2); opacity: 1; }
          80%, 100% { transform: scale(0.8); opacity: 0.4; }
        }
        .loading-dot { animation: loading-dots 1.2s ease-in-out infinite; }
        .loading-dot-1 { animation-delay: 0ms; }
        .loading-dot-2 { animation-delay: 150ms; }
        .loading-dot-3 { animation-delay: 300ms; }
        .loading-dot-4 { animation-delay: 450ms; }
      `}</style>
      <div className={`flex items-center justify-center gap-1.5 ${className}`}>
        <div className={`${sizeClasses[size]} rounded-full bg-primary loading-dot loading-dot-1`} />
        <div className={`${sizeClasses[size]} rounded-full bg-primary loading-dot loading-dot-2`} />
        <div className={`${sizeClasses[size]} rounded-full bg-primary loading-dot loading-dot-3`} />
        <div className={`${sizeClasses[size]} rounded-full bg-primary loading-dot loading-dot-4`} />
      </div>
    </>
  );
}
