/** Fixed height for paired Income vs Expenses + Financial Drawers cards. */
export const INCOME_DRAWERS_PAIR_CARD_H = 'h-[22rem] max-h-[22rem] min-h-[22rem]';

/** Shared card shell (both columns use the same fixed height). */
export const INCOME_DRAWERS_PAIR_CARD = [
  'flex min-w-0 max-w-full flex-col overflow-hidden',
  INCOME_DRAWERS_PAIR_CARD_H,
].join(' ');

/** @deprecated alias */
export const FINANCIAL_DRAWERS_CARD = INCOME_DRAWERS_PAIR_CARD;

/** Grid row: paired cards share fixed height. */
export const INCOME_DRAWERS_PAIR_GRID =
  'mb-2 grid min-h-0 min-w-0 grid-cols-1 gap-2 lg:grid-cols-2 lg:items-stretch';

/** Column wrapper inside the paired grid. */
export const INCOME_DRAWERS_PAIR_COLUMN = 'flex h-full min-h-0 min-w-0 flex-col';

/** Body below section title — fills remaining card height. */
export const INCOME_DRAWERS_PAIR_BODY = 'flex min-h-0 flex-1 flex-col';

/** Chart / list area inside the body. */
export const INCOME_DRAWERS_PAIR_BODY_INNER = 'relative min-h-0 w-full flex-1';

/** Visible bank-account rows before scroll (~3 rows); list height comes from fixed card. */
export const FINANCIAL_DRAWERS_VISIBLE_ROWS = 3;

/** Scrollable drawer list — scroll when more than ~3 rows. */
export const FINANCIAL_DRAWERS_LIST_SCROLL = [
  'nested-scroll-touch-chain scrollbar-hide seamless-scroll',
  INCOME_DRAWERS_PAIR_BODY_INNER,
  'overflow-x-hidden overflow-y-auto',
  '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
].join(' ');

/** Centered empty / placeholder inside Financial Drawers body. */
export const FINANCIAL_DRAWERS_EMPTY_STATE =
  'flex min-h-0 flex-1 items-center justify-center rounded-lg bg-gray-50';

/** @deprecated use INCOME_DRAWERS_PAIR_BODY_INNER */
export const INCOME_VS_EXPENSES_BODY_MIN_H = INCOME_DRAWERS_PAIR_BODY_INNER;
