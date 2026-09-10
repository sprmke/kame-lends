export interface TableColumnSkeleton {
  grow: string;
  headerWidth?: string;
  cellWidth?: string;
  cellHeight?: string;
  pill?: boolean;
  visibility?: string;
}

export const HIDDEN_BELOW_2XL = "hidden 2xl:block";

export const LOANS_TABLE_COLUMNS: TableColumnSkeleton[] = [
  { grow: "grow-[12]", headerWidth: "w-1/2", cellWidth: "w-4/5" },
  { grow: "grow-[7]", pill: true, visibility: HIDDEN_BELOW_2XL },
  { grow: "grow-[7]", pill: true, visibility: HIDDEN_BELOW_2XL },
  { grow: "grow-[8]", cellHeight: "h-8", visibility: HIDDEN_BELOW_2XL },
  { grow: "grow-[8]", cellHeight: "h-8", visibility: HIDDEN_BELOW_2XL },
  { grow: "grow-[10]", cellWidth: "w-3/4" },
  { grow: "grow-[7]", cellWidth: "w-2/3" },
  { grow: "grow-[10]", cellWidth: "w-3/4" },
  { grow: "grow-[10]", cellWidth: "w-3/4" },
  { grow: "grow-[7]", cellWidth: "w-2/3", visibility: HIDDEN_BELOW_2XL },
  {
    grow: "grow-[5]",
    headerWidth: "w-0",
    cellWidth: "w-8",
    visibility: HIDDEN_BELOW_2XL,
  },
];

export const DEBTS_TABLE_COLUMNS: TableColumnSkeleton[] = [
  { grow: "grow-[10]", cellWidth: "w-3/4" },
  { grow: "grow-[18]", headerWidth: "w-1/2", cellWidth: "w-4/5" },
  { grow: "grow-[14]", cellWidth: "w-2/3", visibility: "hidden md:block" },
  { grow: "grow-[12]", cellWidth: "w-3/4" },
  { grow: "grow-[8]", cellWidth: "w-2/3", visibility: "hidden lg:block" },
  { grow: "grow-[10]", pill: true, visibility: "hidden xl:block" },
  { grow: "grow-[5]", headerWidth: "w-0", cellWidth: "w-8" },
];

export const TRANSACTIONS_TABLE_COLUMNS: TableColumnSkeleton[] = [
  { grow: "grow-[12]", cellWidth: "w-3/4" },
  { grow: "grow-[22]", headerWidth: "w-1/3", cellWidth: "w-4/5" },
  { grow: "grow-[18]", headerWidth: "w-2/5", cellWidth: "w-2/3" },
  { grow: "grow-[12]", pill: true, visibility: HIDDEN_BELOW_2XL },
  { grow: "grow-[12]", pill: true },
  { grow: "grow-[14]", cellWidth: "w-3/4" },
  {
    grow: "grow-[5]",
    headerWidth: "w-0",
    cellWidth: "w-8",
    visibility: HIDDEN_BELOW_2XL,
  },
];

export const INVESTORS_TABLE_COLUMNS: TableColumnSkeleton[] = [
  { grow: "grow-[18]", headerWidth: "w-1/2", cellWidth: "w-4/5" },
  { grow: "grow-[16]", cellWidth: "w-3/4" },
  { grow: "grow-[10]", cellWidth: "w-2/3", visibility: HIDDEN_BELOW_2XL },
  { grow: "grow-[10]", cellWidth: "w-3/4" },
  { grow: "grow-[8]", cellWidth: "w-2/3" },
  { grow: "grow-[8]", cellWidth: "w-2/3", visibility: HIDDEN_BELOW_2XL },
  {
    grow: "grow-[5]",
    headerWidth: "w-0",
    cellWidth: "w-8",
    visibility: HIDDEN_BELOW_2XL,
  },
];

export const BORROWERS_TABLE_COLUMNS: TableColumnSkeleton[] = [
  { grow: "grow-[18]", headerWidth: "w-1/2", cellWidth: "w-4/5" },
  { grow: "grow-[16]", cellWidth: "w-3/4", visibility: "hidden md:block" },
  { grow: "grow-[12]", cellWidth: "w-2/3", visibility: "hidden lg:block" },
  { grow: "grow-[8]", cellWidth: "w-2/3" },
  { grow: "grow-[5]", headerWidth: "w-0", cellWidth: "w-8" },
];

export const WITNESSES_TABLE_COLUMNS: TableColumnSkeleton[] = [
  { grow: "grow-[18]", headerWidth: "w-1/2", cellWidth: "w-4/5" },
  { grow: "grow-[16]", cellWidth: "w-3/4", visibility: "hidden md:block" },
  { grow: "grow-[12]", cellWidth: "w-2/3", visibility: "hidden lg:block" },
  { grow: "grow-[8]", cellWidth: "w-2/3" },
  { grow: "grow-[5]", headerWidth: "w-0", cellWidth: "w-8" },
];
