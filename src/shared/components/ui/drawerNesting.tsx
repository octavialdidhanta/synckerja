import { createContext, useContext } from "react";

/** How many app drawers wrap the current component. Used so a sheet opened from a sheet uses Vaul's nested root. */
export const DrawerNestingContext = createContext(0);

export function useDrawerNestingDepth() {
  return useContext(DrawerNestingContext);
}
