export const LAB_MAIN_GRID =
  "grid h-full min-h-0 min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch";

export const LAB_LEFT_COL =
  "col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch lg:col-span-8";

export const LAB_RIGHT_COL =
  "col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch lg:col-span-4";

export const LAB_SECTION =
  "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden";

export const LAB_LEFT_SECTION = LAB_SECTION;

export const LAB_TREE_SCROLL =
  "scrollbar-hide nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const LAB_CARD_BASE =
  "flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-border bg-card shadow-sm";

export const LAB_CARD = `${LAB_CARD_BASE} rounded-lg`;

export const LAB_RIGHT_CARD =
  "scrollbar-hide nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-card p-4 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export const LAB_MT_CARD = `${LAB_CARD_BASE} rounded-sm`;

export const LAB_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
