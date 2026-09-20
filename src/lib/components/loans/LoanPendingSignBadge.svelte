<script lang="ts">
	import LoanSigningProgressBadge from '$lib/components/loans/LoanSigningProgressBadge.svelte';
	import type { LoanWithInvestors } from '$lib/types';

	interface Props {
		loan: LoanWithInvestors;
		class?: string;
		onOpenContractDetails?: () => void;
		compact?: boolean;
	}

	let { loan, class: className, onOpenContractDetails, compact = false }: Props = $props();
</script>

<LoanSigningProgressBadge
	{loan}
	class={className}
	{compact}
	linkWhenViewerPending
	{onOpenContractDetails}
/>
