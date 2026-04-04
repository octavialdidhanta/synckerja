import React, { createContext, useContext, useMemo } from "react";

export type SafeAreaInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

const defaultInsets: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };

const SafeAreaInsetsContext = createContext<SafeAreaInsets>(defaultInsets);

export function SafeAreaInsetsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value?: Partial<SafeAreaInsets>;
}) {
  const merged = useMemo(
    () => ({
      ...defaultInsets,
      ...value,
    }),
    [value],
  );
  return (
    <SafeAreaInsetsContext.Provider value={merged}>{children}</SafeAreaInsetsContext.Provider>
  );
}

export function useSafeAreaInsets(): SafeAreaInsets {
  return useContext(SafeAreaInsetsContext);
}
