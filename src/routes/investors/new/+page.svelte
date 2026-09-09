<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import InvestorForm from '$lib/components/investors/InvestorForm.svelte';
</script>

<svelte:head><title>Create Investor</title></svelte:head>

<DashboardPage class="max-w-2xl">
	<InvestorForm />
</DashboardPage>
