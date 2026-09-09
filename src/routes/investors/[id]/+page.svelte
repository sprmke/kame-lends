<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import InvestorForm from '$lib/components/investors/InvestorForm.svelte';
	import InvestorDetailContent from '$lib/components/investors/InvestorDetailContent.svelte';
	import type { InvestorWithLoans, LoanWithInvestors } from '$lib/types';

	let { data } = $props();

	let isEditing = $state(false);

	const investor = $derived(data.entity as InvestorWithLoans);
	const title = $derived(investor?.name ?? 'Investor');
	const loans = $derived((data.loans ?? []) as LoanWithInvestors[]);
</script>

<svelte:head><title>{title}</title></svelte:head>

<DashboardPage>
	{#if isEditing}
		<InvestorForm
			existingInvestor={investor}
			cancelHref="/investors/{investor.id}"
			successHref="/investors/{investor.id}"
			onCancel={() => (isEditing = false)}
		/>
	{:else}
		<InvestorDetailContent {investor} {loans} onEdit={() => (isEditing = true)} />
	{/if}
</DashboardPage>
