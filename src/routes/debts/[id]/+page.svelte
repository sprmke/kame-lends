<script lang="ts">
	import { onMount } from 'svelte';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import DebtDetailClient from '$lib/components/debts/DebtDetailClient.svelte';
	import type { DebtWithInvestorAndPeriods, Investor } from '$lib/types';

	let { data } = $props();

	const debt = $derived(data.entity as DebtWithInvestorAndPeriods);
	const title = $derived(debt?.name ?? 'Borrowing');

	let investors = $state<Investor[]>([]);

	onMount(async () => {
		try {
			const response = await fetch('/api/investors?simple=true');
			const investorData = await response.json();
			if (Array.isArray(investorData)) investors = investorData;
		} catch (error) {
			console.error('Failed to load investors', error);
		}
	});
</script>

<svelte:head><title>{title}</title></svelte:head>

<DashboardPage>
	<DebtDetailClient initialDebt={debt} {investors} canManage={Boolean(data.canManage)} />
</DashboardPage>
