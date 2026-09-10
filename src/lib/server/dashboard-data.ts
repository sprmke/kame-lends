import { calculateInvestorStats, isOpenLoan } from "$lib/calculations";
import { computePortfolioCapitalStats } from "$lib/loan-list-summary";
import type {
  LoanType,
  LoanWithInvestors,
  InvestorWithLoans,
} from "$lib/types";
import {
  format,
  subWeeks,
  subDays,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  isBefore,
} from "date-fns";
import {
  isMaturingFundedLoan,
  isOverdueLoanForDashboard,
} from "$lib/loan-due-date";
import { eq, inArray, or } from "drizzle-orm";
import { db } from "$lib/server/db";
import { transactions } from "$lib/server/db/schema";
import { getCachedLoans, getCachedInvestors } from "$lib/server/cached-data";
import { loadLinkedInvestorContactIds } from "$lib/server/party-investor-links";
import { remember } from "$lib/server/memory-cache";

export interface CashflowDataPoint {
  label: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface ChartSlice {
  name: string;
  value: number;
  color: string;
}

export interface InvestorCapitalRow {
  name: string;
  capital: number;
  interest: number;
}

export interface PendingDisbursement {
  id: number;
  loanId: number;
  loanName: string;
  loanType: LoanType;
  investorName: string;
  amount: string;
  sentDate: Date;
}

export interface DashboardSummaryData {
  /** Peak concurrent paid principal across all loans (all-time). */
  totalPrincipal: number;
  /** Peak concurrent paid principal on open loans. */
  activePrincipal: number;
  /** Scheduled interest on open loans. */
  interestEstimate: number;
  /** Scheduled interest on completed loans. */
  interestEarned: number;
  activeLoansCount: number;
  overdueLoansCount: number;
  totalLoans: number;
  completedLoansCount: number;
  totalInvestors: number;
  activeInvestors: number;
  upcomingPaymentsToSend: PendingDisbursement[];
  upcomingPaymentsDue: LoanWithInvestors[];
  completedLoansData: LoanWithInvestors[];
  overdueLoansData: LoanWithInvestors[];
}

export interface DashboardChartsData {
  dailyData: CashflowDataPoint[];
  weeklyData: CashflowDataPoint[];
  monthlyData: CashflowDataPoint[];
  loanTypeData: ChartSlice[];
  loanStatusData: ChartSlice[];
  investorCapitalData: InvestorCapitalRow[];
}

export type DashboardData = DashboardSummaryData & DashboardChartsData;

const emptySummary: DashboardSummaryData = {
  totalPrincipal: 0,
  activePrincipal: 0,
  interestEstimate: 0,
  interestEarned: 0,
  activeLoansCount: 0,
  overdueLoansCount: 0,
  totalLoans: 0,
  completedLoansCount: 0,
  totalInvestors: 0,
  activeInvestors: 0,
  upcomingPaymentsToSend: [],
  upcomingPaymentsDue: [],
  completedLoansData: [],
  overdueLoansData: [],
};

const emptyCharts: DashboardChartsData = {
  dailyData: [],
  weeklyData: [],
  monthlyData: [],
  loanTypeData: [],
  loanStatusData: [],
  investorCapitalData: [],
};

export async function queryDashboardSummary(
  userId: string,
): Promise<DashboardSummaryData> {
  try {
    return await remember(`dashboard:summary:${userId}`, () =>
      loadDashboardSummary(userId),
    );
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    return emptySummary;
  }
}

export async function queryDashboardCharts(
  userId: string,
): Promise<DashboardChartsData> {
  try {
    return await remember(`dashboard:charts:${userId}`, () =>
      loadDashboardCharts(userId),
    );
  } catch (error) {
    console.error("Error fetching dashboard charts:", error);
    return emptyCharts;
  }
}

/** Full dashboard payload (e.g. tests). Runs summary + charts in parallel. */
export async function queryDashboardData(
  userId: string,
): Promise<DashboardData> {
  const [summary, charts] = await Promise.all([
    queryDashboardSummary(userId),
    queryDashboardCharts(userId),
  ]);
  return { ...summary, ...charts };
}

async function loadDashboardSummary(
  userId: string,
): Promise<DashboardSummaryData> {
  const [allLoans, allInvestors] = await Promise.all([
    getCachedLoans(userId, "list"),
    getCachedInvestors(userId, "list"),
  ]);

  const loans = allLoans as LoanWithInvestors[];
  const investorsList = allInvestors as InvestorWithLoans[];

  const completedLoansData = loans.filter((loan) => !isOpenLoan(loan));
  const capital = computePortfolioCapitalStats(loans);

  const activeLoansCount = loans.filter(
    (loan) =>
      loan.status === "Fully Funded" || loan.status === "Partially Funded",
  ).length;
  const completedLoansCount = completedLoansData.length;
  const overdueLoansCount = loans.filter(
    (loan) => loan.status === "Overdue",
  ).length;

  const activeInvestors = investorsList.filter((inv) =>
    inv.loanInvestors.some(
      (li) =>
        li.loan.status === "Fully Funded" ||
        li.loan.status === "Partially Funded",
    ),
  ).length;

  const unpaidLoanTransactions: PendingDisbursement[] = [];
  for (const loan of loans) {
    for (const li of loan.loanInvestors.filter((x) => !x.isPaid)) {
      unpaidLoanTransactions.push({
        id: li.id,
        loanId: loan.id,
        loanName: loan.loanName,
        loanType: loan.type,
        investorName: li.investor.name,
        amount: li.amount,
        sentDate: li.sentDate,
      });
    }
  }

  return {
    totalPrincipal: capital.totalPrincipal,
    activePrincipal: capital.activePrincipal,
    interestEstimate: capital.interestEstimate,
    interestEarned: capital.interestEarned,
    activeLoansCount,
    overdueLoansCount,
    totalLoans: loans.length,
    completedLoansCount,
    totalInvestors: investorsList.length,
    activeInvestors,
    upcomingPaymentsToSend: unpaidLoanTransactions.sort(
      (a, b) => new Date(a.sentDate).getTime() - new Date(b.sentDate).getTime(),
    ),
    upcomingPaymentsDue: loans
      .filter((loan) => isMaturingFundedLoan(loan))
      .sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      ),
    completedLoansData: [...completedLoansData].sort(
      (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime(),
    ),
    overdueLoansData: loans
      .filter((loan) => isOverdueLoanForDashboard(loan))
      .sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      ),
  };
}

async function loadDashboardCharts(
  userId: string,
): Promise<DashboardChartsData> {
  const [loans, investorsList, allTransactions] = await Promise.all([
    getCachedLoans(userId, "list") as Promise<LoanWithInvestors[]>,
    getCachedInvestors(userId, "list") as Promise<InvestorWithLoans[]>,
    loadDashboardTransactions(userId),
  ]);

  const completedLoansCount = loans.filter(
    (loan) => loan.status === "Completed",
  ).length;
  const overdueLoansCount = loans.filter(
    (loan) => loan.status === "Overdue",
  ).length;

  const isValidInflow = (t: (typeof allTransactions)[number]) => {
    if (t.direction !== "In") return false;
    if (!t.loan) return true;
    return t.loan.status === "Completed";
  };

  const dailyData: CashflowDataPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const dayDate = subDays(new Date(), i);
    const dayStart = startOfDay(dayDate);
    const dayEnd = endOfDay(dayDate);
    const dayTransactions = allTransactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= dayStart && tDate <= dayEnd;
    });
    const dayInflow = dayTransactions
      .filter(isValidInflow)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const dayOutflow = dayTransactions
      .filter((t) => t.direction === "Out")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    dailyData.push({
      label: format(dayStart, "MMM dd"),
      inflow: dayInflow,
      outflow: dayOutflow,
      net: dayInflow - dayOutflow,
    });
  }

  const weeklyData: CashflowDataPoint[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekDate = subWeeks(new Date(), i);
    const weekStart = startOfWeek(weekDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(weekDate, { weekStartsOn: 0 });
    const weekTransactions = allTransactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= weekStart && tDate <= weekEnd;
    });
    const weekInflow = weekTransactions
      .filter(isValidInflow)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const weekOutflow = weekTransactions
      .filter((t) => t.direction === "Out")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    weeklyData.push({
      label: format(weekStart, "MMM dd"),
      inflow: weekInflow,
      outflow: weekOutflow,
      net: weekInflow - weekOutflow,
    });
  }

  const monthlyData: CashflowDataPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(new Date(), i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const monthTransactions = allTransactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= monthStart && tDate <= monthEnd;
    });
    const monthInflow = monthTransactions
      .filter(isValidInflow)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const monthOutflow = monthTransactions
      .filter((t) => t.direction === "Out")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    monthlyData.push({
      label: format(monthStart, "MMM yyyy"),
      inflow: monthInflow,
      outflow: monthOutflow,
      net: monthInflow - monthOutflow,
    });
  }

  const loanTypeData: ChartSlice[] = [
    {
      name: "Lot Title",
      value: loans.filter((l) => l.type === "Lot Title").length,
      color: "#fb9f44",
    },
    {
      name: "OR/CR",
      value: loans.filter((l) => l.type === "OR/CR").length,
      color: "#7c6dcb",
    },
    {
      name: "Agent",
      value: loans.filter((l) => l.type === "Agent").length,
      color: "#dc6b6b",
    },
  ].filter((item) => item.value > 0);

  const loanStatusData: ChartSlice[] = [
    {
      name: "Fully Funded",
      value: loans.filter((l) => l.status === "Fully Funded").length,
      color: "#34b39a",
    },
    {
      name: "Partially Funded",
      value: loans.filter((l) => l.status === "Partially Funded").length,
      color: "#d4a535",
    },
    { name: "Completed", value: completedLoansCount, color: "#fb9f44" },
    { name: "Overdue", value: overdueLoansCount, color: "#dc6b6b" },
  ].filter((item) => item.value > 0);

  const investorCapitalData = investorsList
    .map((inv) => {
      const stats = calculateInvestorStats(inv);
      return {
        name: inv.name,
        capital: stats.totalCapital,
        interest: stats.totalInterest,
      };
    })
    .sort((a, b) => b.capital - a.capital)
    .slice(0, 5);

  return {
    dailyData,
    weeklyData,
    monthlyData,
    loanTypeData,
    loanStatusData,
    investorCapitalData,
  };
}

async function loadDashboardTransactions(userId: string) {
  return remember(`dashboard:transactions:${userId}`, async () => {
    const linkedInvestorIds = await loadLinkedInvestorContactIds(userId);

    return db.query.transactions.findMany({
      where:
        linkedInvestorIds.length > 0
          ? or(
              eq(transactions.userId, userId),
              inArray(transactions.investorId, linkedInvestorIds),
            )
          : eq(transactions.userId, userId),
      columns: {
        id: true,
        date: true,
        direction: true,
        amount: true,
      },
      with: {
        loan: { columns: { status: true } },
      },
      orderBy: (t, { desc }) => [desc(t.date)],
    });
  });
}
