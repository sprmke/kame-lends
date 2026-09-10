<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import WitnessForm from '$lib/components/witnesses/WitnessForm.svelte';
</script>

<svelte:head><title>Create Witness</title></svelte:head>

<DashboardPage class="max-w-2xl">
	<WitnessForm cancelHref="/witnesses" successHref="/witnesses" />
</DashboardPage>
