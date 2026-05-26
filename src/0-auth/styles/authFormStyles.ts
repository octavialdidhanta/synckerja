/** Shared login / register form typography, spacing, and control sizes. */

export const authFormRootClass = "flex w-full flex-col gap-3 sm:gap-5";

export const authFormHeaderLogoWrapper =
  "mb-1 flex w-full justify-center [&_img]:max-h-10 sm:[&_img]:max-h-12";

export const authFormTitleClass = "text-lg font-bold tracking-tight text-slate-900 sm:text-2xl";

export const authFormSubtitleClass = "mt-0.5 text-xs leading-snug text-slate-600 sm:mt-1 sm:text-sm";

export const authFormGoogleSectionClass = "flex flex-col gap-2";

export const authFormFormClass = "flex flex-col gap-3 sm:gap-4";

export const authFormFieldGap = "space-y-1";

export const authFormLabelClass = "text-xs font-medium text-slate-800 sm:text-sm";

export const authFormInputClass =
  "h-10 border-slate-200 bg-white text-base focus-visible:ring-[hsl(var(--brand-blue))] sm:h-11";

export const authFormInputWithToggleClass = `${authFormInputClass} pr-10`;

export const authFormPasswordToggleClass =
  "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:pointer-events-none";

export const authFormEyeIconClass = "h-4 w-4";

export const authFormSubmitClass =
  "h-10 w-full text-sm font-semibold text-white shadow-md transition-colors hover:opacity-[0.92] sm:h-11 sm:text-base";

export const authFormFooterTextClass = "text-center text-xs text-slate-600 sm:text-sm";

export const authFormForgotLinkClass =
  "text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--brand-blue))] hover:underline sm:text-xs";

export const authFormBottomSpacerClass = "h-2 shrink-0 sm:h-0";
