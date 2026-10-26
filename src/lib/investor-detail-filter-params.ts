import {
  filterBooleanParam,
  filterEnum,
  filterString,
  filterStringArray,
} from "$lib/list-filter-bindings";
import {
  compactListFilterValues,
  type ListFilterValues,
} from "$lib/list-filter-persistence";

export const INVESTOR_DETAIL_LOAN_FILTER_KEYS = [
  "lq",
  "lstatus",
  "ltype",
  "lfreeLot",
  "lminPrincipal",
  "lmaxPrincipal",
  "lminAvgRate",
  "lmaxAvgRate",
  "lminInterest",
  "lmaxInterest",
  "lminTotalAmount",
  "lmaxTotalAmount",
] as const;

export const INVESTOR_DETAIL_DEBT_FILTER_KEYS = [
  "dq",
  "drepaid",
  "dinterval",
  "dminAmount",
  "dmaxAmount",
] as const;

const FREE_LOT_VALUES = ["all", "with", "without"] as const;

export function parseInvestorDetailLoanFilterValues(values: ListFilterValues) {
  return {
    searchQuery: filterString(values, "lq", ""),
    statusFilter: filterStringArray(values, "lstatus"),
    typeFilter: filterStringArray(values, "ltype"),
    freeLotFilter: filterEnum(values, "lfreeLot", "all", FREE_LOT_VALUES),
    minPrincipal: filterString(values, "lminPrincipal"),
    maxPrincipal: filterString(values, "lmaxPrincipal"),
    minAvgRate: filterString(values, "lminAvgRate"),
    maxAvgRate: filterString(values, "lmaxAvgRate"),
    minInterest: filterString(values, "lminInterest"),
    maxInterest: filterString(values, "lmaxInterest"),
    minTotalAmount: filterString(values, "lminTotalAmount"),
    maxTotalAmount: filterString(values, "lmaxTotalAmount"),
  };
}

export function snapshotInvestorDetailLoanFilters(state: {
  searchQuery: string;
  statusFilter: string[];
  typeFilter: string[];
  freeLotFilter: string;
  minPrincipal: string;
  maxPrincipal: string;
  minAvgRate: string;
  maxAvgRate: string;
  minInterest: string;
  maxInterest: string;
  minTotalAmount: string;
  maxTotalAmount: string;
}): ListFilterValues {
  return compactListFilterValues({
    lq: state.searchQuery,
    lstatus: state.statusFilter,
    ltype: state.typeFilter,
    lfreeLot: state.freeLotFilter === "all" ? "" : state.freeLotFilter,
    lminPrincipal: state.minPrincipal,
    lmaxPrincipal: state.maxPrincipal,
    lminAvgRate: state.minAvgRate,
    lmaxAvgRate: state.maxAvgRate,
    lminInterest: state.minInterest,
    lmaxInterest: state.maxInterest,
    lminTotalAmount: state.minTotalAmount,
    lmaxTotalAmount: state.maxTotalAmount,
  });
}

export function parseInvestorDetailDebtFilterValues(values: ListFilterValues) {
  return {
    searchQuery: filterString(values, "dq", ""),
    showPastDebts: filterBooleanParam(values, "drepaid"),
    intervalFilter: filterStringArray(values, "dinterval"),
    minAmount: filterString(values, "dminAmount"),
    maxAmount: filterString(values, "dmaxAmount"),
  };
}

export function snapshotInvestorDetailDebtFilters(state: {
  searchQuery: string;
  showPastDebts: boolean;
  intervalFilter: string[];
  minAmount: string;
  maxAmount: string;
}): ListFilterValues {
  return compactListFilterValues({
    dq: state.searchQuery,
    drepaid: state.showPastDebts ? "show" : "",
    dinterval: state.intervalFilter,
    dminAmount: state.minAmount,
    dmaxAmount: state.maxAmount,
  });
}
