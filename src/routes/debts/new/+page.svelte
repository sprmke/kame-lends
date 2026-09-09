<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import DebtForm from '$lib/components/debts/DebtForm.svelte';
	import FormPageSkeleton from '$lib/components/common/FormPageSkeleton.svelte';
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

<svelte:head><title>Create Borrowing</title></svelte:head>

<DashboardPage class="max-w-4xl">
	{#if loading}
		<FormPageSkeleton />
	{:else}
		<DebtForm {investors} />
	{/if}
</DashboardPage>
