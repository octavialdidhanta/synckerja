import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const HeaderActionsTargetContext = createContext<HTMLElement | null>(null);
const HeaderActionsSetTargetContext = createContext<
  ((el: HTMLElement | null) => void) | null
>(null);

export function AttendanceSettingsHeaderActionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  return (
    <HeaderActionsSetTargetContext.Provider value={setTarget}>
      <HeaderActionsTargetContext.Provider value={target}>
        {children}
      </HeaderActionsTargetContext.Provider>
    </HeaderActionsSetTargetContext.Provider>
  );
}

/** Mount point in the main card header for section action buttons. */
export function AttendanceSettingsHeaderActionsSlot() {
  const setTarget = useContext(HeaderActionsSetTargetContext);
  return <div ref={setTarget} className="flex shrink-0 items-center gap-2" />;
}

/** Renders `children` into the main card header actions slot. */
export function AttendanceSettingsHeaderActions({
  children,
}: {
  children: ReactNode;
}) {
  const target = useContext(HeaderActionsTargetContext);
  if (!target) return null;
  return createPortal(children, target);
}
