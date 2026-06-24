/** Sticky Platform / Account column (div flex layout). */
export const SCHEDULE_TABLE_PLATFORM_HEAD_CLASS =
  'sticky left-0 z-[3] shrink-0 w-[156px] min-w-[156px] rounded-none border-r border-border bg-muted pl-3 pr-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/70 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.14)]';

export const SCHEDULE_TABLE_PLATFORM_CELL_CLASS =
  'sticky left-0 z-[2] flex shrink-0 w-[156px] min-w-[156px] flex-col justify-center self-stretch rounded-none border-r border-border bg-card py-2 pl-3 pr-3 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.14)] group-hover:bg-muted';

/** Scrollable middle columns group. */
export const SCHEDULE_TABLE_MIDDLE_GROUP_CLASS = 'flex shrink-0';

export const SCHEDULE_TABLE_STATUS_CELL_CLASS =
  'flex w-[108px] min-w-[108px] shrink-0 flex-col justify-center rounded-none bg-card p-2 group-hover:bg-muted';

export const SCHEDULE_TABLE_CONNECTION_CELL_CLASS =
  'flex w-[180px] min-w-[180px] max-w-[240px] shrink-0 flex-col justify-center rounded-none bg-card p-2 group-hover:bg-muted';

export const SCHEDULE_TABLE_VISIBILITY_CELL_CLASS =
  'flex w-[128px] min-w-[128px] shrink-0 flex-col justify-center rounded-none bg-card p-2 group-hover:bg-muted';

export const SCHEDULE_TABLE_TIME_CELL_CLASS =
  'flex w-[340px] min-w-[220px] shrink-0 flex-col justify-center rounded-none bg-card p-2 group-hover:bg-muted';

export const SCHEDULE_TABLE_MIDDLE_HEAD_CLASS =
  'rounded-none bg-muted px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/70';

/** Sticky Actions — square corners, slight left overlap to seal seam (no ::before). */
export const SCHEDULE_TABLE_ACTIONS_HEAD_CLASS =
  'sticky right-0 z-[10] -ml-1 box-border flex w-[93px] min-w-[93px] shrink-0 items-center justify-center self-stretch rounded-none border-l border-border bg-muted py-2.5 pl-1 pr-2 text-center text-[11px] font-semibold uppercase tracking-wide text-foreground/70';

export const SCHEDULE_TABLE_ACTIONS_CELL_CLASS =
  'sticky right-0 z-[10] -ml-1 box-border flex w-[93px] min-w-[93px] shrink-0 items-center justify-center self-stretch rounded-none border-l border-border bg-card py-0 pl-1 pr-0 group-hover:bg-muted';

export const SCHEDULE_TABLE_SCROLL_CLASS =
  'w-full overflow-x-auto overflow-y-visible rounded-none [-ms-overflow-style:auto] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5';

export const SCHEDULE_TABLE_HEADER_ROW_CLASS =
  'flex min-w-max rounded-none border-b border-border bg-muted';

export const SCHEDULE_TABLE_BODY_ROW_CLASS =
  'group flex min-w-max rounded-none border-b border-border bg-card transition-colors last:border-b-0 hover:bg-muted';
