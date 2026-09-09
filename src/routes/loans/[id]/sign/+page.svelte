<script lang="ts">
	import ContractSigningClient from '$lib/components/signing/ContractSigningClient.svelte';

	let { data } = $props();
</script>

<div class="mx-auto max-w-5xl px-4 py-6">
	<ContractSigningClient loanId={data.loanId} initialData={data.signing} />
</div>
