<script lang="ts">
	import { onMount } from 'svelte';
	import LoanSigningLinksPanel from './LoanSigningLinksPanel.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import type { SigningInvitationSummary } from '$lib/loan-signing';

	interface Props {
		loanId: number;
		highlight?: boolean;
		refreshKey?: number | string;
	}

	let { loanId, highlight = false, refreshKey = 0 }: Props = $props();

	let invitations = $state<SigningInvitationSummary[]>([]);
	let isLoading = $state(true);

	async function loadSigningLinks() {
		isLoading = true;
		try {
			const response = await fetch(`/api/loans/${loanId}/signing`);
			if (!response.ok) return;
			const data = await response.json();
			invitations = data.invitations ?? [];
		} catch (error) {
			console.error('Error loading signing links:', error);
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		void loanId;
		void refreshKey;
		loadSigningLinks();
	});

	onMount(() => {
		if (highlight) {
			const section = document.getElementById('contract-signing-section');
			section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	});
</script>

{#if isLoading}
	<div class="space-y-3">
		<Skeleton class="h-6 w-48" />
		<Skeleton class="h-24 w-full" />
	</div>
{:else if invitations.length > 0}
	<div
		id="contract-signing-section"
		class={highlight ? 'rounded-xl ring-2 ring-primary/30' : undefined}
	>
		<LoanSigningLinksPanel {loanId} {invitations} />
	</div>
{/if}
