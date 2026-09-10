import { cn } from "$lib/utils";

/** Shared visual tokens for Checkbox + CheckboxDisplay (matches kame-homes). */
export const checkboxRootClassName = cn(
  "border-muted-foreground/45 bg-background size-[18px] shrink-0 rounded-[5px] border-2 shadow-sm",
  "transition-[color,background-color,border-color,box-shadow] duration-150 ease-out",
  "hover:border-primary/70",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
  "data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
  "data-checked:shadow-[0_1px_3px_color-mix(in_oklch,var(--primary)_35%,transparent)]",
  "data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground",
  "data-indeterminate:shadow-[0_1px_3px_color-mix(in_oklch,var(--primary)_35%,transparent)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export const checkboxIndicatorClassName =
  "grid place-content-center text-current [&>svg]:size-3 [&>svg]:stroke-[3]";
