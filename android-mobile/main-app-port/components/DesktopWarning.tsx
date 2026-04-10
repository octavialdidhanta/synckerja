interface DesktopWarningProps {
  children: React.ReactNode;
}

/**
 * Wrapper for mobile-only routes. No longer shows QR code:
 * handphone and tablet portrait go directly to mobile version;
 * tablet landscape and desktop are handled by routing (desktop version).
 * This component now always renders children.
 */
export const DesktopWarning = ({ children }: DesktopWarningProps) => {
  return <>{children}</>;
};
