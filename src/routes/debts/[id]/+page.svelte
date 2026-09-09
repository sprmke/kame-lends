<script lang="ts">
	import { onMount } from 'svelte';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import DebtDetailClient from '$lib/components/debts/DebtDetailClient.svelte';
	import ListPageSkeleton from '$lib/components/common/ListPageSkeleton.svelte';
	import type { DebtWithInvestorAndPeriods, Investor } from '$lib/types';

	let { data } = $props();

	const debt = $derived(data.entity as DebtWithInvestorAndPeriods);
	const title = $derived(debt?.name ?? 'Borrowing');

	let investors = $state<Investor[]>([]);
	let loadingInvestors = $state(true);

	onMount(async () => {
		try {
			const response = await fetch('/api/investors?simple=true');
			const investorData = await response.json();
			if (Array.isArray(investorData)) investors = investorData;
		} catch (error) {
			console.error('Failed to load investors', error);
		} finally {
			loadingInvestors = false;
		}
	});
</script>

<svelte:head><title>{title}</title></svelte:head>

<DashboardPage>
	{#if loadingInvestors}
		<ListPageSkeleton variant="debts" />
	{:else}
		<DebtDetailClient initialDebt={debt} {investors} />
	{/if}
</DashboardPage>
