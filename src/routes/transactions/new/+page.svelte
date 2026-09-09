<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TransactionForm from '$lib/components/transactions/TransactionForm.svelte';
	import FormPageSkeleton from '$lib/components/common/FormPageSkeleton.svelte';
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';
	import type { Investor } from '$lib/types';

	let investors = $state<Investor[]>([]);
	let loading = $state(true);

	onMount(async () => {
		try {
			const response = await fetch('/api/investors?simple=true');
			const data = await response.json();
			if (Array.isArray(data)) investors = data;
		} catch (error) {
			console.error('Failed to load investors', error);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head><title>New Transaction</title></svelte:head>

<DashboardPage>
	<PageHeader title="New Transaction">
		<Button href="/transactions" variant="outline" size="sm">Back</Button>
	</PageHeader>
	{#if loading}
		<FormPageSkeleton />
	{:else}
		<TransactionForm {investors} />
	{/if}
</DashboardPage>
