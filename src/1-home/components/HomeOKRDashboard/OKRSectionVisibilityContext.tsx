import React, { createContext, useContext, useRef, useEffect, useState, type ReactNode } from 'react';

type OKRSectionVisibilityContextValue = {
  isVisible: boolean;
  sectionRef: React.RefObject<HTMLDivElement | null>;
};

const defaultValue: OKRSectionVisibilityContextValue = {
  isVisible: true,
  sectionRef: { current: null },
};

const OKRSectionVisibilityContext = createContext<OKRSectionVisibilityContextValue>(defaultValue);

/**
 * Provider that tracks when the OKR section is in viewport.
 * When used on home, department objectives fetch is deferred until section is visible.
 * When provider is not used (e.g. other pages), isVisible defaults to true so fetch runs as before.
 */
export function OKRSectionVisibilityProvider({ children }: { children: ReactNode }) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  /** Start true so queries run on first paint (home skeleton gate needs data while overlay shows). */
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry?.isIntersecting ?? false),
      { threshold: 0.05, rootMargin: '80px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const value: OKRSectionVisibilityContextValue = {
    isVisible,
    sectionRef,
  };

  return (
    <OKRSectionVisibilityContext.Provider value={value}>
      <div ref={sectionRef} className="min-h-0 flex flex-col flex-1">
        {children}
      </div>
    </OKRSectionVisibilityContext.Provider>
  );
}

export function useOKRSectionVisibility(): boolean {
  const ctx = useContext(OKRSectionVisibilityContext);
  return ctx?.isVisible ?? true;
}
