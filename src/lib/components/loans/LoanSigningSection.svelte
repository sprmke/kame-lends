<script lang="ts">
	import { onMount } from 'svelte';
	import LoanSigningLinksPanel from './LoanSigningLinksPanel.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { fetchSigningClient } from '$lib/composables/loan-detail-client-cache';
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
	let viewerInvitationId = $state<number | null>(null);
	let isLoading = $state(true);
	let loadError = $state<string | null>(null);
	let loadSeq = 0;

	$effect(() => {
		const id = loanId;
		void refreshKey;
		const seq = ++loadSeq;
		invitations = [];
		viewerInvitationId = null;
		isLoading = true;
		loadError = null;

		void fetchSigningClient(id)
			.then((data) => {
				if (seq !== loadSeq) return;
				if (!data) {
					loadError = 'Could not load contract signing status.';
					invitations = [];
					viewerInvitationId = null;
					onStatsChange?.(0, 0);
					return;
				}
				invitations = data.invitations ?? [];
				viewerInvitationId = data.viewerInvitationId ?? null;
				const signed = invitations.filter((item) => item.signedAt).length;
				onStatsChange?.(signed, invitations.length);
			})
			.catch((error) => {
				if (seq !== loadSeq) return;
				console.error('Error loading signing links:', error);
				loadError = 'Could not load contract signing status.';
				invitations = [];
				viewerInvitationId = null;
				onStatsChange?.(0, 0);
			})
			.finally(() => {
				if (seq === loadSeq) isLoading = false;
			});
	});

	onMount(() => {
		if (highlight && variant === 'card') {
			const section = document.getElementById('contract-signing-section');
			section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	});
</script>

{#if isLoading}
	<div class="surface-card space-y-3 p-4" aria-busy="true" aria-label="Loading signing status" role="status">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<Skeleton class="h-5 w-40 max-w-full" />
			<div class="flex items-center gap-2">
				<Skeleton class="h-9 w-28 rounded-xl" />
				<Skeleton class="h-5 w-24 rounded-full" />
			</div>
		</div>
		<div class="divide-y divide-border rounded-lg border border-border">
			{#each Array.from({ length: 3 }) as _, index (index)}
				<div
					class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4"
				>
					<div class="min-w-0 flex-1 space-y-1.5">
						<Skeleton class="h-4 w-32 max-w-full" />
						<Skeleton class="h-3 w-40 max-w-full" />
					</div>
					<Skeleton class="h-5 w-16 shrink-0 self-end rounded-full sm:self-auto" />
				</div>
			{/each}
		</div>
	</div>
{:else if invitations.length > 0}
	<div
		id="contract-signing-section"
		class={highlight && variant === 'card' ? 'rounded-xl ring-2 ring-primary/30' : undefined}
	>
		<LoanSigningLinksPanel {loanId} {invitations} {viewerInvitationId} {variant} />
	</div>
{:else if loadError}
	<p class="text-sm text-destructive">{loadError}</p>
{:else if variant === 'plain'}
	<p class="text-sm text-muted-foreground">No signing parties yet.</p>
{/if}
