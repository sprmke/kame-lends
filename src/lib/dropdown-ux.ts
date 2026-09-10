/** Show search when option count reaches this threshold. */
export const DROPDOWN_SEARCH_THRESHOLD = 8;

/** Tailwind class for scrollable dropdown list areas. */
export const DROPDOWN_LIST_MAX_HEIGHT_CLASS = "max-h-60";

export interface DropdownOption {
  value: string;
  label: string;
}

export function filterDropdownOptions(
  options: DropdownOption[],
  query: string,
): DropdownOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return options;
  return options.filter((option) =>
    option.label.toLowerCase().includes(normalized),
  );
}

export function shouldShowDropdownSearch(
  optionCount: number,
  searchable?: boolean,
): boolean {
  if (searchable !== undefined) return searchable;
  return optionCount >= DROPDOWN_SEARCH_THRESHOLD;
}
