/**
 * Request-scoped viewer data for assistant tools.
 *
 * One turn loads each dataset at most once, using the same cached loaders and
 * viewer scoping as the app's screens. Tools never touch `db` directly and
 * never receive a user id that is not derived from the session.
 */
/**
 * Server data modules are imported lazily so the tool catalog can be loaded by
 * offline eval scripts and tests without opening a database connection.
 */
async function data() {
  return import("$lib/server/cached-data");
}
async function access() {
  return import("$lib/server/access-control");
}
async function loanDetail() {
  return import("$lib/server/loan-detail");
}
import type {
  Borrower,
  DebtWithInvestor,
  Investor,
  LoanGroupWithDetails,
  LoanWithInvestors,
  Witness,
} from "$lib/types";
import { buildLoanLedger, type LoanLedger } from "$lib/money/ledger";

export interface ViewerGroup {
  id: number;
  name: string;
  color: string;
  loanIds: number[];
  createdByViewer: boolean;
}

interface PartyCandidate {
  type: "borrower" | "investor" | "witness";
  id: number;
  name: string;
  email: string | null;
  loanCount: number;
}

export class ViewerData {
  private readonly memo = new Map<string, Promise<unknown>>();

  constructor(
    readonly userId: string,
    readonly today: string,
    readonly role: string | null,
  ) {}

  private once<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const hit = this.memo.get(key) as Promise<T> | undefined;
    if (hit) return hit;
    const task = fn();
    this.memo.set(key, task);
    return task;
  }

  /** Loans the viewer can see through the app's `all` list scope. */
  loans(): Promise<LoanWithInvestors[]> {
    return this.once(
      "loans",
      async () =>
        (await (
          await data()
        ).getCachedLoansByScope(
          this.userId,
          "all",
          "list",
        )) as LoanWithInvestors[],
    );
  }

  groupLoans(): Promise<LoanWithInvestors[]> {
    return this.once("group-loans", async () => {
      const loans = await this.loans();
      const seen = new Set(loans.map((loan) => loan.id));
      const candidates: number[] = [];
      for (const group of await this.groups()) {
        for (const loanId of group.loanIds) {
          if (!seen.has(loanId) && !candidates.includes(loanId)) {
            candidates.push(loanId);
          }
        }
      }
      const result: LoanWithInvestors[] = [];
      const [a, detailModule] = await Promise.all([access(), loanDetail()]);
      for (const loanId of candidates.slice(0, 50)) {
        if (!(await a.hasLoanGroupViewAccess(loanId, this.userId))) continue;
        const detail = await detailModule
          .loadLoanDetail(loanId, this.userId)
          .catch(() => null);
        if (detail) result.push(detail);
      }
      return result;
    });
  }

  async allLoans(): Promise<LoanWithInvestors[]> {
    const [loans, groupLoans] = await Promise.all([
      this.loans(),
      this.groupLoans(),
    ]);
    return [...loans, ...groupLoans];
  }

  async loanById(id: number): Promise<LoanWithInvestors | null> {
    const loans = await this.allLoans();
    const hit = loans.find((loan) => loan.id === id);
    if (hit) return hit;
    const [a, detailModule] = await Promise.all([access(), loanDetail()]);
    if (!(await a.hasLoanGroupViewAccess(id, this.userId))) return null;
    const detail = await detailModule
      .loadLoanDetail(id, this.userId)
      .catch(() => null);
    return detail ?? null;
  }

  ledger(loan: LoanWithInvestors): LoanLedger {
    return buildLoanLedger(loan, {
      today: this.today,
      statusOverride:
        (loan as { statusOverride?: string | null }).statusOverride ===
        "Completed"
          ? "Completed"
          : null,
    });
  }

  ledgers(): Promise<Array<{ loan: LoanWithInvestors; ledger: LoanLedger }>> {
    return this.once("ledgers", async () =>
      (await this.allLoans()).map((loan) => ({
        loan,
        ledger: this.ledger(loan),
      })),
    );
  }

  borrowers(): Promise<Borrower[]> {
    return this.once("borrowers", async () => {
      const module = await data();
      const [cached, loans] = await Promise.all([
        module.getCachedBorrowers(this.userId, "simple") as Promise<Borrower[]>,
        this.allLoans(),
      ]);
      const byId = new Map<number, Borrower>();
      for (const row of cached) byId.set(row.id, row);
      for (const loan of loans) {
        if (loan.borrower) {
          byId.set(loan.borrower.id, loan.borrower as Borrower);
        }
      }
      return [...byId.values()];
    });
  }

  investors(): Promise<Investor[]> {
    return this.once("investors", async () => {
      const module = await data();
      const [cached, loans] = await Promise.all([
        module.getCachedInvestors(this.userId, "simple") as Promise<Investor[]>,
        this.allLoans(),
      ]);
      const byId = new Map<number, Investor>();
      for (const row of cached) byId.set(row.id, row);
      for (const loan of loans) {
        for (const allocation of loan.loanInvestors) {
          if (allocation.investor) {
            byId.set(allocation.investor.id, allocation.investor);
          }
        }
      }
      return [...byId.values()];
    });
  }

  witnesses(): Promise<Witness[]> {
    return this.once(
      "witnesses",
      async () =>
        (await (
          await data()
        ).getCachedWitnesses(this.userId, "simple")) as Witness[],
    );
  }

  debts(): Promise<DebtWithInvestor[]> {
    return this.once(
      "debts",
      async () =>
        (await (
          await data()
        ).getCachedDebts(this.userId, null)) as DebtWithInvestor[],
    );
  }

  groups(): Promise<ViewerGroup[]> {
    return this.once("groups", async () => {
      const groups = (await (
        await data()
      ).getCachedGroupsForUser(this.userId)) as LoanGroupWithDetails[];
      return groups.map((group) => ({
        id: group.id,
        name: group.name,
        color: group.color ?? "orange",
        loanIds: (group.groupLoans ?? []).map((row) => row.loanId),
        createdByViewer: group.creatorUserId === this.userId,
      }));
    });
  }

  async groupById(id: number): Promise<ViewerGroup | null> {
    return (await this.groups()).find((group) => group.id === id) ?? null;
  }

  async groupLoanIds(id: number): Promise<number[]> {
    const group = await this.groupById(id);
    return group?.loanIds ?? [];
  }

  /** All loans in a group the viewer can open. */
  async groupLoansFor(id: number): Promise<LoanWithInvestors[]> {
    const ids = await this.groupLoanIds(id);
    if (ids.length === 0) return [];
    const all = await this.allLoans();
    const byId = new Map(all.map((loan) => [loan.id, loan]));
    const result: LoanWithInvestors[] = [];
    for (const loanId of ids) {
      const hit = byId.get(loanId);
      if (hit) {
        result.push(hit);
        continue;
      }
      const [a, detailModule] = await Promise.all([access(), loanDetail()]);
      if (!(await a.hasLoanGroupViewAccess(loanId, this.userId))) continue;
      const detail = await detailModule
        .loadLoanDetail(loanId, this.userId)
        .catch(() => null);
      if (detail) result.push(detail);
    }
    return result;
  }

  async loanIdsForGroupViewer(): Promise<number[]> {
    const loans = await this.loans();
    const seen = new Set(loans.map((loan) => loan.id));
    const ids = new Set<number>();
    for (const group of await this.groups()) {
      for (const loanId of group.loanIds) {
        if (!seen.has(loanId)) ids.add(loanId);
      }
    }
    const result: number[] = [];
    const a = await access();
    for (const loanId of ids) {
      if (await a.hasLoanGroupViewAccess(loanId, this.userId))
        result.push(loanId);
    }
    return result;
  }

  partyCandidates(): Promise<PartyCandidate[]> {
    return this.once("party-candidates", async () => {
      const [loans, borrowers, investors, witnesses] = await Promise.all([
        this.allLoans(),
        this.borrowers(),
        this.investors(),
        this.witnesses(),
      ]);
      const borrowerLoanCount = new Map<number, number>();
      const investorLoanCount = new Map<number, number>();
      for (const loan of loans) {
        if (loan.borrowerId != null) {
          borrowerLoanCount.set(
            loan.borrowerId,
            (borrowerLoanCount.get(loan.borrowerId) ?? 0) + 1,
          );
        }
        for (const allocation of loan.loanInvestors) {
          investorLoanCount.set(
            allocation.investorId,
            (investorLoanCount.get(allocation.investorId) ?? 0) + 1,
          );
        }
      }
      const rows: PartyCandidate[] = [];
      for (const borrower of borrowers) {
        rows.push({
          type: "borrower",
          id: borrower.id,
          name: borrower.name,
          email: borrower.email ?? null,
          loanCount: borrowerLoanCount.get(borrower.id) ?? 0,
        });
      }
      for (const investor of investors) {
        rows.push({
          type: "investor",
          id: investor.id,
          name: investor.name,
          email: investor.email ?? null,
          loanCount: investorLoanCount.get(investor.id) ?? 0,
        });
      }
      for (const witness of witnesses) {
        rows.push({
          type: "witness",
          id: witness.id,
          name: witness.name,
          email: witness.email ?? null,
          loanCount: 0,
        });
      }
      return rows;
    });
  }

  /** Group ids for a loan, used to explain shared visibility. */
  groupIdsForLoan(loanId: number): Promise<number[]> {
    return this.once(`loan-groups:${loanId}`, async () =>
      (await access()).getLoanGroupViewIds(loanId, this.userId),
    );
  }
}
