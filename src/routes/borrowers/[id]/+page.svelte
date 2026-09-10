<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import BorrowerDetailClient from '$lib/components/borrowers/BorrowerDetailClient.svelte';
	import type { BorrowerWithLoans } from '$lib/types';

	let { data } = $props();

	const borrower = $derived(data.entity as BorrowerWithLoans);
	const title = $derived(borrower?.name ?? 'Borrower');
</script>

<svelte:head><title>{title}</title></svelte:head>

<DashboardPage>
	<BorrowerDetailClient initialBorrower={borrower} canManage={Boolean(data.canManage)} />
</DashboardPage>
