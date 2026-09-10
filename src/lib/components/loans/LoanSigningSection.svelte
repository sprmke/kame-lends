<script lang="ts">
	import { onMount } from 'svelte';
	import LoanSigningLinksPanel from './LoanSigningLinksPanel.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import type { SigningInvitationSummary } from '$lib/loan-signing';

	interface Props {
		loanId: number;
		highlight?: boolean;
		refreshKey?: number | string;
		variant?: 'card' | 'plain';
		onStatsChange?: (signed: number, total: number) => void;
	}

	let {
		loanId,
		highlight = false,
		refreshKey = 0,
		variant = 'card',
		onStatsChange
	}: Props = $props();

	let invitations = $state<SigningInvitationSummary[]>([]);
	let isLoading = $state(true);
	let loadError = $state<string | null>(null);
	let loadSeq = 0;

	async function loadSigningLinks() {
		const seq = ++loadSeq;
		isLoading = true;
		loadError = null;
		try {
			const response = await fetch(`/api/loans/${loanId}/signing`);
			if (seq !== loadSeq) return;
			if (!response.ok) {
				loadError = 'Could not load contract signing status.';
				invitations = [];
				onStatsChange?.(0, 0);
				return;
			}
			const data = await response.json();
			invitations = data.invitations ?? [];
			const signed = invitations.filter((item) => item.signedAt).length;
			onStatsChange?.(signed, invitations.length);
		} catch (error) {
			if (seq !== loadSeq) return;
			console.error('Error loading signing links:', error);
			loadError = 'Could not load contract signing status.';
			invitations = [];
			onStatsChange?.(0, 0);
		} finally {
			if (seq === loadSeq) {
				isLoading = false;
			}
		}
	}

	$effect(() => {
		void loanId;
		void refreshKey;
		void loadSigningLinks();
	});

	onMount(() => {
		if (highlight && variant === 'card') {
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
		class={highlight && variant === 'card' ? 'rounded-xl ring-2 ring-primary/30' : undefined}
	>
		<LoanSigningLinksPanel {loanId} {invitations} {variant} />
	</div>
{:else if loadError}
	<p class="text-sm text-destructive">{loadError}</p>
{:else if variant === 'plain'}
	<p class="text-sm text-muted-foreground">No signing parties yet.</p>
{/if}
