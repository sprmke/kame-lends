import { page } from "$app/state";
import { replaceState } from "$app/navigation";
import type { GroupChipSelection } from "$lib/components/groups/types";
import { SHOW_GROUPS_UI } from "$lib/feature-flags";
import {
  buildGroupChipsForLoans,
  countUngrouped,
  filterLoansByGroup,
  groupSelectionToParam,
  parseGroupSelection,
  type GroupsIndexItem,
} from "$lib/groups/loan-group-filter";
import type { LoanWithInvestors } from "$lib/types";

type Options = {
  getLoans: () => LoanWithInvestors[] | null;
  /** Owner loans list shows Ungrouped chip; role lenses do not. */
  showUngrouped?: boolean | (() => boolean);
  scopeNoun?: string;
};

/**
 * Shared group chip / URL `?group=` scope for Loans, Investments, Borrowed, Witnessed.
 */
export function createLoanListGroupScope(options: Options) {
  const showUngrouped = $derived.by(() => {
    const value = options.showUngrouped;
    if (typeof value === "function") return value();
    return Boolean(value);
  });

  const groupsIndex = $derived(
    ((page.data as { groupsIndex?: GroupsIndexItem[] }).groupsIndex ??
      []) as GroupsIndexItem[],
  );

  const groupSelection = $derived(
    parseGroupSelection(page.url.searchParams.get("group")),
  );

  const groupChips = $derived(
    buildGroupChipsForLoans(options.getLoans() ?? [], groupsIndex),
  );

  const ungroupedCount = $derived(countUngrouped(options.getLoans() ?? []));

  const showGroupBar = $derived(
    SHOW_GROUPS_UI &&
      (groupChips.length > 0 || (showUngrouped && ungroupedCount > 0)),
  );

  const selectedGroupInfo = $derived.by(() => {
    if (typeof groupSelection !== "number") return null;
    const meta = groupsIndex.find((g) => g.id === groupSelection);
    const chip = groupChips.find((g) => g.id === groupSelection);
    if (!meta || !chip) return null;
    return {
      id: meta.id,
      name: meta.name,
      countOnPage: chip.loanCountOnPage,
    };
  });

  function setGroupSelection(value: GroupChipSelection) {
    const url = new URL(page.url);
    const param = groupSelectionToParam(value);
    if (param) url.searchParams.set("group", param);
    else url.searchParams.delete("group");
    replaceState(`${url.pathname}${url.search}${url.hash}`, page.state);
  }

  function applyGroupFilter(loans: LoanWithInvestors[]): LoanWithInvestors[] {
    return filterLoansByGroup(loans, groupSelection);
  }

  return {
    get groupsIndex() {
      return groupsIndex;
    },
    get groupSelection() {
      return groupSelection;
    },
    get groupChips() {
      return groupChips;
    },
    get ungroupedCount() {
      return ungroupedCount;
    },
    get showGroupBar() {
      return showGroupBar;
    },
    get showUngrouped() {
      return showUngrouped;
    },
    get selectedGroupInfo() {
      return selectedGroupInfo;
    },
    get scopeNoun() {
      return options.scopeNoun ?? "loans";
    },
    setGroupSelection,
    applyGroupFilter,
  };
}
