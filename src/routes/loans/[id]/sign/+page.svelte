<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import ContractSigningClient from '$lib/components/signing/ContractSigningClient.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Sign Loan Agreement</title></svelte:head>

<DashboardPage>
	<ContractSigningClient loanId={data.loanId} initialData={data.signing} />
</DashboardPage>
