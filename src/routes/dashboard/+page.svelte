<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import DashboardQuickActionsMenu from '$lib/components/dashboard/DashboardQuickActionsMenu.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SummaryCard from '$lib/components/common/SummaryCard.svelte';
	import DashboardActivityCards from '$lib/components/common/DashboardActivityCards.svelte';
	import DashboardSummarySkeleton from '$lib/components/common/DashboardSummarySkeleton.svelte';
	import DashboardChartsSkeleton from '$lib/components/common/DashboardChartsSkeleton.svelte';
	import OverdueChecker from '$lib/components/common/OverdueChecker.svelte';
	import CashflowTrendChart from '$lib/components/charts/CashflowTrendChart.svelte';
	import CurrencyBarChart from '$lib/components/charts/CurrencyBarChart.svelte';
	import LoanTypePieChart from '$lib/components/charts/LoanTypePieChart.svelte';
	import { SHOW_TRANSACTIONS_UI } from '$lib/feature-flags';
	import { cn } from '$lib/utils';

	let { data } = $props();
</script>

<svelte:head><title>Dashboard</title></svelte:head>

<DashboardPage>
	<OverdueChecker />

	{#await data.summary}
		<DashboardSummarySkeleton />
	{:then summary}
		{@const hasAnyActivity =
			summary.upcomingPaymentsDue.length > 0 ||
			summary.overdueLoansData.length > 0 ||
			summary.upcomingPaymentsToSend.length > 0 ||
			summary.completedLoansData.length > 0}

		<PageHeader
			title="Dashboard"
			description="Overview of your lending performance and upcoming activity."
			eyebrow="Welcome back"
			showPriceToggle={true}
		>
			<DashboardQuickActionsMenu navCapabilities={data.navCapabilities} />
		</PageHeader>

		<SummaryCard
			metrics={[
				{
					label: 'Total Principal',
					amount: summary.totalPrincipal
				},
				{
					label: 'Active',
					amount: summary.activePrincipal
				},
				{
					label: 'Interest Estimate',
					amount: summary.interestEstimate
				},
				{
					label: 'Interest Earned',
					amount: summary.interestEarned,
					valueClassName: 'text-chart-2'
				}
			]}
		/>

		<section class={cn('dashboard-section', !hasAnyActivity && 'hidden 2xl:block')}>
			<div class="dashboard-section-header">
				<div>
					<p class="section-eyebrow">Activity</p>
					<h2 class="dashboard-section-title">Needs attention</h2>
				</div>
			</div>
			<DashboardActivityCards
				completedLoans={summary.completedLoansData}
				overdueLoans={summary.overdueLoansData}
				pendingDisbursements={summary.upcomingPaymentsToSend}
				upcomingPaymentsDue={summary.upcomingPaymentsDue}
			/>
		</section>

		{#await data.charts}
			<DashboardChartsSkeleton />
		{:then charts}
			<section class="dashboard-section">
				<div>
					<p class="section-eyebrow">Analytics</p>
					<h2 class="dashboard-section-title">Trends & insights</h2>
				</div>
				<div class={cn('grid gap-5', SHOW_TRANSACTIONS_UI ? 'lg:grid-cols-2' : 'lg:grid-cols-1')}>
					{#if SHOW_TRANSACTIONS_UI}
						<CashflowTrendChart
							dailyData={charts.dailyData}
							weeklyData={charts.weeklyData}
							monthlyData={charts.monthlyData}
							title="Cashflow Trend"
							emptyMessage="No cashflow data"
						/>
					{/if}
					<CurrencyBarChart
						data={charts.investorCapitalData}
						title="Top Investors by Capital"
						emptyMessage="No investors found"
					/>
				</div>
			</section>

			<section class="dashboard-section">
				<div>
					<p class="section-eyebrow">Portfolio</p>
					<h2 class="dashboard-section-title">Distribution</h2>
				</div>
				<div class="grid gap-5 lg:grid-cols-2">
					<LoanTypePieChart
						data={charts.loanTypeData}
						title="Loan Type Distribution"
						emptyMessage="No loans found"
					/>
					<LoanTypePieChart
						data={charts.loanStatusData}
						title="Loan Status Distribution"
						emptyMessage="No loans found"
					/>
				</div>
			</section>
		{:catch}
			<p class="text-sm text-destructive">Charts failed to load</p>
		{/await}
	{:catch}
		<p class="text-sm text-destructive">Dashboard failed to load</p>
	{/await}
</DashboardPage>
