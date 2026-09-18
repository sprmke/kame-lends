import type { LoanListPageScope } from "$lib/components/loans/loan-list-page-config";
import type { LoanListScope } from "$lib/server/cached-data";

/** URL `?scope=` on `/loans` (and legacy redirects). */
export type LoanScopeParam =
  "mine" | "investing" | "borrowed" | "commissioned" | "witnessed";

export type LoanScopeTab = {
  param: LoanScopeParam;
  label: string;
  listScope: LoanListScope;
  pageScope: LoanListPageScope;
};

export const LOAN_SCOPE_TABS: LoanScopeTab[] = [
  {
    param: "mine",
    label: "Managing",
    listScope: "owned",
    pageScope: "loans",
  },
  {
    param: "investing",
    label: "Invested",
    listScope: "investments",
    pageScope: "investments",
  },
  {
    param: "borrowed",
    label: "Borrowed",
    listScope: "borrowed",
    pageScope: "borrowed",
  },
  {
    param: "witnessed",
    label: "Witnessed",
    listScope: "witnessed",
    pageScope: "witnessed",
  },
  {
    param: "commissioned",
    label: "Commissioned",
    listScope: "commissioned",
    pageScope: "commissioned",
  },
];

const BY_PARAM = new Map(LOAN_SCOPE_TABS.map((t) => [t.param, t]));

/** Legacy paths `/investments`, etc. → query param. */
const LEGACY_PATH_SCOPE: Record<string, LoanScopeParam> = {
  investments: "investing",
  borrowed: "borrowed",
  commissioned: "commissioned",
  witnessed: "witnessed",
};

export function loanScopeParamFromLegacyPath(
  segment: string,
): LoanScopeParam | null {
  return LEGACY_PATH_SCOPE[segment] ?? null;
}

export function resolveLoanScopeTab(
  param: string | null | undefined,
): LoanScopeTab {
  const key = (param?.trim().toLowerCase() || "mine") as LoanScopeParam;
  return BY_PARAM.get(key) ?? LOAN_SCOPE_TABS[0]!;
}
