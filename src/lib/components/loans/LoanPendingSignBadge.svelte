<script lang="ts">
	import LoanSigningStatusBadge from '$lib/components/loans/LoanSigningStatusBadge.svelte';
	import type { LoanWithInvestors } from '$lib/types';

	interface Props {
		loan: LoanWithInvestors;
		class?: string;
	}

	let { loan, class: className }: Props = $props();
</script>

<LoanSigningStatusBadge {loan} class={className} />
