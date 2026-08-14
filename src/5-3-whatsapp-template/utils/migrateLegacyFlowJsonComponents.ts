/** Synckerja previously emitted `TextEntry`; Meta expects `TextInput`. */
export function migrateLegacyFlowJsonComponents(doc: Record<string, unknown>): Record<string, unknown> {
  const screens = doc.screens;
  if (!Array.isArray(screens)) return doc;

  const migratedScreens = screens.map((screen) => {
    if (screen == null || typeof screen !== "object") return screen;
    const screenObj = screen as Record<string, unknown>;
    const layout = screenObj.layout;
    if (layout == null || typeof layout !== "object") return screen;
    const layoutObj = layout as Record<string, unknown>;
    const children = layoutObj.children;
    if (!Array.isArray(children)) return screen;

    const migratedChildren = children.map((child) => {
      if (child == null || typeof child !== "object") return child;
      const row = child as Record<string, unknown>;
      if (String(row.type ?? "") === "TextEntry") {
        return { ...row, type: "TextInput" };
      }
      return child;
    });

    return {
      ...screenObj,
      layout: {
        ...layoutObj,
        children: migratedChildren,
      },
    };
  });

  return { ...doc, screens: migratedScreens };
}
