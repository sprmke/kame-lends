import type { MultiSelectOption } from "$lib/components/common/MultiSelectFilter.svelte";
import { UNASSIGNED_PARTICIPANT_FILTER_OPTION } from "$lib/list-filters";
import {
  getLoanWitnessIds,
  hasActiveLoanParticipantFilters,
  matchesLoanParticipantFilters,
  type LoanParticipantFilterState,
} from "$lib/loan-list-page-filters";
import type { LoanWithInvestors } from "$lib/types";

type PersonOption = { id: number; name: string };

const WITNESS_PARTY_ROLES = new Set(["witness_1", "witness_2"]);

function sortByName(people: PersonOption[]) {
  return [...people].sort((a, b) => a.name.localeCompare(b.name));
}

function toMultiSelectOptions(people: PersonOption[]): MultiSelectOption[] {
  return people.map((person) => ({
    value: String(person.id),
    label: person.name,
  }));
}

function mergeWitnessOptions(
  apiWitnesses: PersonOption[],
  loans: LoanWithInvestors[],
): PersonOption[] {
  const byId = new Map(apiWitnesses.map((witness) => [witness.id, witness]));

  for (const loan of loans) {
    for (const invitation of loan.signingInvitations ?? []) {
      if (
        !WITNESS_PARTY_ROLES.has(invitation.partyRole) ||
        !invitation.witness
      ) {
        continue;
      }
      byId.set(invitation.witness.id, {
        id: invitation.witness.id,
        name: invitation.witness.name,
      });
    }
  }

  return sortByName([...byId.values()]);
}

export function createLoanListParticipantFilters(
  getLoans: () => LoanWithInvestors[] | null = () => null,
) {
  let selectedInvestors = $state<string[]>([]);
  let selectedBorrowers = $state<string[]>([]);
  let selectedWitnesses = $state<string[]>([]);
  let investorOptions = $state<PersonOption[]>([]);
  let borrowerOptions = $state<PersonOption[]>([]);
  let apiWitnessOptions = $state<PersonOption[]>([]);
  let loaded = $state(false);

  const filterState = $derived<LoanParticipantFilterState>({
    selectedInvestors,
    selectedBorrowers,
    selectedWitnesses,
  });

  const hasActiveParticipantFilters = $derived(
    hasActiveLoanParticipantFilters(filterState),
  );

  const investorFilterOptions = $derived(toMultiSelectOptions(investorOptions));
  const borrowerFilterOptions = $derived([
    UNASSIGNED_PARTICIPANT_FILTER_OPTION,
    ...toMultiSelectOptions(borrowerOptions),
  ]);
  const witnessFilterOptions = $derived.by(() => {
    const loans = getLoans() ?? [];
    return [
      UNASSIGNED_PARTICIPANT_FILTER_OPTION,
      ...toMultiSelectOptions(mergeWitnessOptions(apiWitnessOptions, loans)),
    ];
  });

  async function loadFilterOptions() {
    if (loaded) return;

    try {
      const [investorRes, borrowerRes, witnessRes] = await Promise.all([
        fetch("/api/investors?simple=true"),
        fetch("/api/borrowers?simple=true"),
        fetch("/api/witnesses?simple=true"),
      ]);

      const investorData = await investorRes.json();
      const borrowerData = await borrowerRes.json();
      const witnessData = await witnessRes.json();

      if (Array.isArray(investorData)) {
        investorOptions = sortByName(
          investorData.map((investor: PersonOption) => ({
            id: investor.id,
            name: investor.name,
          })),
        );
      }

      if (Array.isArray(borrowerData)) {
        borrowerOptions = sortByName(
          borrowerData.map((borrower: PersonOption) => ({
            id: borrower.id,
            name: borrower.name,
          })),
        );
      }

      if (Array.isArray(witnessData)) {
        apiWitnessOptions = sortByName(
          witnessData.map((witness: PersonOption) => ({
            id: witness.id,
            name: witness.name,
          })),
        );
      }

      loaded = true;
    } catch (error) {
      console.error("Failed to load loan list participant filters", error);
    }
  }

  function clearParticipantFilters() {
    selectedInvestors = [];
    selectedBorrowers = [];
    selectedWitnesses = [];
  }

  function matchesParticipantFilters(loan: LoanWithInvestors): boolean {
    return matchesLoanParticipantFilters(loan, filterState);
  }

  return {
    loadFilterOptions,
    clearParticipantFilters,
    matchesParticipantFilters,
    getLoanWitnessIds,
    get selectedInvestors() {
      return selectedInvestors;
    },
    set selectedInvestors(value: string[]) {
      selectedInvestors = value;
    },
    get selectedBorrowers() {
      return selectedBorrowers;
    },
    set selectedBorrowers(value: string[]) {
      selectedBorrowers = value;
    },
    get selectedWitnesses() {
      return selectedWitnesses;
    },
    set selectedWitnesses(value: string[]) {
      selectedWitnesses = value;
    },
    get investorFilterOptions() {
      return investorFilterOptions;
    },
    get borrowerFilterOptions() {
      return borrowerFilterOptions;
    },
    get witnessFilterOptions() {
      return witnessFilterOptions;
    },
    get hasActiveParticipantFilters() {
      return hasActiveParticipantFilters;
    },
  };
}
