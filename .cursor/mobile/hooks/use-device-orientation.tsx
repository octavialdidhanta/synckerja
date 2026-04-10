import * as React from "react";

const MOBILE_BREAKPOINT = 768;
export const TABLET_MAX = 1024;

/**
 * True when we should show the desktop layout (desktop version of the app).
 * - Desktop: width > 1024
 * - Tablet landscape: 768 <= width <= 1024 and orientation landscape
 * False for handphone (width < 768) and tablet portrait (768-1024 portrait) → they get mobile version.
 */
export function useDesktopLayout(): boolean {
  const [desktopLayout, setDesktopLayout] = React.useState<boolean | undefined>(
    typeof window !== "undefined"
      ? computeDesktopLayout(window.innerWidth, window.innerHeight)
      : undefined
  );

  React.useEffect(() => {
    const update = () => {
      setDesktopLayout(computeDesktopLayout(window.innerWidth, window.innerHeight));
    };

    const mqWidth = window.matchMedia(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_MAX}px)`
    );
    const mqDesktop = window.matchMedia(`(min-width: ${TABLET_MAX + 1}px)`);
    const mqPortrait = window.matchMedia("(orientation: portrait)");
    const mqLandscape = window.matchMedia("(orientation: landscape)");

    update();

    mqWidth.addEventListener("change", update);
    mqDesktop.addEventListener("change", update);
    mqPortrait.addEventListener("change", update);
    mqLandscape.addEventListener("change", update);

    return () => {
      mqWidth.removeEventListener("change", update);
      mqDesktop.removeEventListener("change", update);
      mqPortrait.removeEventListener("change", update);
      mqLandscape.removeEventListener("change", update);
    };
  }, []);

  return desktopLayout === true;
}

function computeDesktopLayout(width: number, height: number): boolean {
  if (width > TABLET_MAX) return true;
  if (width < MOBILE_BREAKPOINT) return false;
  // Tablet range 768–1024: desktop layout only in landscape
  return width > height;
}
