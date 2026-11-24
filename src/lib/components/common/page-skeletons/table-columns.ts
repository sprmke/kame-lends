export interface TableColumnSkeleton {
  /** Tailwind grow weight for the column. */
  grow: string;
  headerWidth?: string;
  cellWidth?: string;
  cellHeight?: string;
  /** Rounded pill placeholder (badges, status). */
  pill?: boolean;
  /** Numeric columns align right in the real table. */
  align?: "left" | "right";
  /** CSS visibility class copied from the real column. */
  visibility?: string;
}

export const HIDDEN_BELOW_MD = "hidden md:block";
export const HIDDEN_BELOW_LG = "hidden lg:block";
export const HIDDEN_BELOW_XL = "hidden xl:block";
export const HIDDEN_BELOW_2XL = "hidden 2xl:block";

/** Loans table: Loan, Type (md+), Status (lg+), Signing (md+), Total, Due (md+), Actions. */
export const LOANS_TABLE_COLUMNS: TableColumnSkeleton[] = [
  { grow: "grow-[22]", headerWidth: "w-12", cellWidth: "w-3/4" },
  { grow: "grow-[10]", pill: true, visibility: HIDDEN_BELOW_MD },
  { grow: "grow-[10]", pill: true, visibility: HIDDEN_BELOW_LG },
  {
    grow: "grow-[10]",
    cellHeight: "h-5",
    cellWidth: "w-16",
    visibility: HIDDEN_BELOW_MD,
  },
  {
    grow: "grow-[14]",
    headerWidth: "w-2/3",
    cellWidth: "w-3/4",
    align: "right",
  },
  { grow: "grow-[10]", cellWidth: "w-2/3", visibility: HIDDEN_BELOW_MD },
];

/** Bank loans table: Start date, Name, Investor (md+), Principal, Rate (lg+), Period (xl+), Actions. */
export const DEBTS_TABLE_COLUMNS: TableColumnSkeleton[] = [
  { grow: "grow-[10]", cellWidth: "w-3/4" },
  { grow: "grow-[18]", headerWidth: "w-1/2", cellWidth: "w-3/4" },
  { grow: "grow-[14]", cellWidth: "w-2/3", visibility: HIDDEN_BELOW_MD },
  { grow: "grow-[12]", cellWidth: "w-3/4", align: "right" },
  {
    grow: "grow-[8]",
    cellWidth: "w-2/3",
    visibility: HIDDEN_BELOW_LG,
    align: "right",
  },
  { grow: "grow-[10]", pill: true, visibility: HIDDEN_BELOW_XL },
];

/** Transactions table: Date, Name, Investor (md+), Type (lg+), Direction, Amount. */
export const TRANSACTIONS_TABLE_COLUMNS: TableColumnSkeleton[] = [
  { grow: "grow-[10]", cellWidth: "w-3/5" },
  { grow: "grow-[22]", headerWidth: "w-1/3", cellWidth: "w-3/4" },
  {
    grow: "grow-[18]",
    headerWidth: "w-2/5",
    cellWidth: "w-2/3",
    visibility: HIDDEN_BELOW_MD,
  },
  { grow: "grow-[12]", pill: true, visibility: HIDDEN_BELOW_LG },
  { grow: "grow-[12]", pill: true },
  { grow: "grow-[14]", cellWidth: "w-3/4", align: "right" },
];

/** Investors table: Name, Email (md+), Capital, Rate (lg+), Interest (xl+), Amount, Actions. */
export const INVESTORS_TABLE_COLUMNS: TableColumnSkeleton[] = [
  { grow: "grow-[18]", headerWidth: "w-1/2", cellWidth: "w-3/4" },
  { grow: "grow-[16]", cellWidth: "w-3/4", visibility: HIDDEN_BELOW_MD },
  { grow: "grow-[10]", cellWidth: "w-2/3", align: "right" },
  {
    grow: "grow-[8]",
    cellWidth: "w-2/3",
    visibility: HIDDEN_BELOW_LG,
    align: "right",
  },
  {
    grow: "grow-[10]",
    cellWidth: "w-3/4",
    visibility: HIDDEN_BELOW_XL,
    align: "right",
  },
  { grow: "grow-[8]", cellWidth: "w-2/3", align: "right" },
];

/** Borrowers table: Name, Email (md+), Contact (lg+), Loans, Actions. */
export const BORROWERS_TABLE_COLUMNS: TableColumnSkeleton[] = [
  { grow: "grow-[18]", headerWidth: "w-1/2", cellWidth: "w-3/4" },
  { grow: "grow-[16]", cellWidth: "w-3/4", visibility: HIDDEN_BELOW_MD },
  { grow: "grow-[12]", cellWidth: "w-2/3", visibility: HIDDEN_BELOW_LG },
  { grow: "grow-[8]", cellWidth: "w-8", align: "right" },
];

/** Witnesses table: Name, Email (md+), Contact (lg+), Loans, Actions. */
export const WITNESSES_TABLE_COLUMNS: TableColumnSkeleton[] = [
  { grow: "grow-[18]", headerWidth: "w-1/2", cellWidth: "w-3/4" },
  { grow: "grow-[16]", cellWidth: "w-3/4", visibility: HIDDEN_BELOW_MD },
  { grow: "grow-[12]", cellWidth: "w-2/3", visibility: HIDDEN_BELOW_LG },
  { grow: "grow-[8]", cellWidth: "w-8", align: "right" },
];
