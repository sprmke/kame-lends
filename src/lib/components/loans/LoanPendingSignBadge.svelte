<script lang="ts">
	import LoanSigningProgressBadge from '$lib/components/loans/LoanSigningProgressBadge.svelte';
	import type { LoanWithInvestors } from '$lib/types';

	interface Props {
		loan: LoanWithInvestors;
		class?: string;
		onOpenContractDetails?: () => void;
	}

	let { loan, class: className, onOpenContractDetails }: Props = $props();
</script>

<LoanSigningProgressBadge
	{loan}
	class={className}
	linkWhenViewerPending
	{onOpenContractDetails}
/>
