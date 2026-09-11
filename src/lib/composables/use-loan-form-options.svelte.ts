import { toast } from "$lib/toast";
import type { Borrower, Investor } from "$lib/types";

/** Cached investors/borrowers for loan create/edit modals. Prefetch on list pages for instant opens. */
export function createLoanFormOptions() {
  let investors = $state<Investor[]>([]);
  let borrowers = $state<Borrower[]>([]);
  let loading = $state(false);
  let loaded = $state(false);
  let loadPromise: Promise<void> | null = null;

  async function load() {
    if (loaded) return;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      loading = true;
      try {
        const [investorRes, borrowerRes] = await Promise.all([
          fetch("/api/investors?simple=true"),
          fetch("/api/borrowers?simple=true"),
        ]);
        const investorData = await investorRes.json();
        const borrowerData = await borrowerRes.json();
        if (Array.isArray(investorData)) investors = investorData;
        if (Array.isArray(borrowerData)) borrowers = borrowerData;
        loaded = true;
      } catch (error) {
        console.error("Failed to load loan form data", error);
        toast.error("Failed to load form data");
      } finally {
        loading = false;
        loadPromise = null;
      }
    })();

    return loadPromise;
  }

  function prefetch() {
    void load();
  }

  return {
    get investors() {
      return investors;
    },
    get borrowers() {
      return borrowers;
    },
    get loading() {
      return loading;
    },
    get loaded() {
      return loaded;
    },
    load,
    prefetch,
  };
}
