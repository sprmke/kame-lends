<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import WitnessDetailClient from '$lib/components/witnesses/WitnessDetailClient.svelte';
	import type { WitnessWithLoans } from '$lib/types';

	let { data } = $props();

	const witness = $derived(data.entity as WitnessWithLoans);
	const title = $derived(witness?.name ?? 'Witness');
</script>

<svelte:head><title>{title}</title></svelte:head>

<DashboardPage>
	<WitnessDetailClient initialWitness={witness} canManage={Boolean(data.canManage)} />
</DashboardPage>
