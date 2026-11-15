<script lang="ts">
	import SummaryCard, {
		type MetricItem
	} from '$lib/components/common/SummaryCard.svelte';
	import DashboardActivityCards from '$lib/components/common/DashboardActivityCards.svelte';
	import { buildTotalLotMetric } from '$lib/lot-utils';
	import { investorOverviewDetails } from '$lib/summary-metric-details';
	import { INVESTOR_DETAIL_SUMMARY_GRID } from '$lib/summary-grid';
	import type { InvestorPortfolioCapitalStats } from '$lib/loan-list-summary';
	import type { InvestorDebtStats } from '$lib/debt-calculations';
	import type { LoanWithInvestors } from '$lib/types';
	import type { PendingDisbursement } from '$lib/server/dashboard-data';

	interface Props {
		showBorrowings: boolean;
		showInterestStats: boolean;
		overviewStats: InvestorPortfolioCapitalStats & {
			netEarnings: number;
			totalLot: number;
			totalLotWithDepacto: number;
		};
		debtStats: InvestorDebtStats;
		completedLoans: LoanWithInvestors[];
		overdueLoans: LoanWithInvestors[];
		pendingDisbursements: PendingDisbursement[];
		maturingLoans: LoanWithInvestors[];
	}

	let {
		showBorrowings,
		showInterestStats,
		overviewStats,
		debtStats,
		completedLoans,
		overdueLoans,
		pendingDisbursements,
		maturingLoans
	}: Props = $props();

	const metrics = $derived<MetricItem[]>([
		{
			label: 'Total Capital',
			detail: investorOverviewDetails.totalCapital,
			amount: overviewStats.totalCapital,
			subCount: overviewStats.totalLoanCount,
			subCountSuffix: ' loans'
		},
		{
			label: 'Active',
			detail: investorOverviewDetails.active,
			amount: overviewStats.activeCapital,
			subCount: overviewStats.activeLoansCount,
			subCountSuffix: ' loans'
		},
		...(showBorrowings
			? [
					{
						label: 'Active Bank Loans',
						detail: investorOverviewDetails.activeBankLoans,
						amount: debtStats.activePrincipal,
						subCount: debtStats.activeCount,
						subCountSuffix: ' bank loans',
						empty: debtStats.totalCount === 0
					},
					{
						label: 'Bank Loan Cost Paid',
						detail: investorOverviewDetails.bankLoanCostPaid,
						amount: debtStats.interestPaid,
						subValue: 'Interest and fees paid',
						empty: debtStats.totalCount === 0
					}
				]
			: []),
		...(showInterestStats
			? [
					{
						label: 'Interest Estimate',
						detail: investorOverviewDetails.interestEstimate,
						amount: overviewStats.interestEstimate
					},
					{
						label: 'Interest Earned',
						detail: investorOverviewDetails.interestEarned,
						amount: overviewStats.interestEarned,
						subValue: 'Completed loans',
						valueClassName: 'text-chart-2'
					},
					{
						label: 'Net Earnings',
						detail:
							debtStats.totalCount > 0
								? investorOverviewDetails.netWithBank
								: investorOverviewDetails.netWithoutBank,
						amount: overviewStats.netEarnings,
						subValue:
							debtStats.totalCount > 0
								? 'Loan interest - Bank loan cost'
								: 'Loan interest scheduled',
						valueClassName:
							overviewStats.netEarnings >= 0 ? undefined : 'text-chart-3'
					}
				]
			: []),
		buildTotalLotMetric(overviewStats.totalLot, overviewStats.totalLotWithDepacto)
	]);
</script>

<SummaryCard class={INVESTOR_DETAIL_SUMMARY_GRID} {metrics} />

<DashboardActivityCards
	{completedLoans}
	{overdueLoans}
	{pendingDisbursements}
	upcomingPaymentsDue={maturingLoans}
/>
