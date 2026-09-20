<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import LoanCommissionSummaryCards from '$lib/components/loans/LoanCommissionSummaryCards.svelte';
	import LoanListSummaryCards from '$lib/components/loans/LoanListSummaryCards.svelte';
	import {
		computeInvestorLoanListSummaryStats,
		computeLoanListSummaryStats,
		computePartyCommissionStats,
		type InvestorLoanAllocation
	} from '$lib/loan-list-summary';
	import type { LoanWithInvestors } from '$lib/types';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		loans: LoanWithInvestors[];
		from?: string | null;
		to?: string | null;
		showCommission?: boolean;
		/** When set, summary cards use this investor's allocations instead of full loan totals. */
		investorAllocations?: InvestorLoanAllocation[] | null;
	}

	let {
		open,
		onOpenChange,
		loans,
		from = null,
		to = null,
		showCommission = false,
		investorAllocations = null
	}: Props = $props();

	const summaryStats = $derived(
		investorAllocations
			? computeInvestorLoanListSummaryStats(investorAllocations, from, to)
			: computeLoanListSummaryStats(loans, from, to)
	);
	const commissionStats = $derived(computePartyCommissionStats(loans, from, to));
</script>

<ResponsiveModal {open} {onOpenChange} title="Summary" contentClass="sm:max-w-4xl">
	{#if showCommission}
		<LoanCommissionSummaryCards stats={commissionStats} />
	{:else}
		<LoanListSummaryCards stats={summaryStats} />
	{/if}
</ResponsiveModal>
