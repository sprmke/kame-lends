<script lang="ts">
	import { page } from '$app/state';
	import { Badge } from '$lib/components/ui/badge';
	import {
		loanSigningDisplayStatus,
		loanSigningPagePath,
		loanSigningProgressFromLoan
	} from '$lib/loan-signing';
	import { cn } from '$lib/utils';
	import type { LoanWithInvestors } from '$lib/types';
	import { PenLine } from 'lucide-svelte';

	interface Props {
		loan: LoanWithInvestors;
		class?: string;
		/** Table column: em dash when there are no signing invitations. */
		showEmpty?: boolean;
		/** When the viewer still owes a signature, link to the sign page. */
		linkWhenViewerPending?: boolean;
		/** Opens Contract Details (e.g. after the viewer signed or for admin progress). */
		onOpenContractDetails?: () => void;
	}

	let {
		loan,
		class: className,
		showEmpty = false,
		linkWhenViewerPending = false,
		onOpenContractDetails
	}: Props = $props();

	const progress = $derived(loanSigningProgressFromLoan(loan));
	const progressLabel = $derived(
		progress ? `${progress.signed}/${progress.total} Signed` : ''
	);
	const complete = $derived(
		progress != null && progress.signed === progress.total && progress.total > 0
	);
	const viewerStatus = $derived(
		linkWhenViewerPending
			? loanSigningDisplayStatus(
					loan,
					page.data.session?.user?.id,
					page.data.session?.user?.email
				)
			: 'none'
	);
	const viewerPending = $derived(viewerStatus === 'pending');
	const openContractDetails = $derived(
		Boolean(onOpenContractDetails) && !viewerPending
	);

	const pendingBadgeClass = $derived(
		cn(
			'gap-1 border-destructive/45 text-[10px] text-destructive dark:text-red-400',
			className
		)
	);
	const progressBadgeClass = $derived(
		cn(
			'text-[10px] tabular-nums',
			complete
				? 'border-emerald-500/45 text-emerald-800 dark:text-emerald-300'
				: 'border-amber-500/45 text-amber-800 dark:text-amber-300',
			className
		)
	);
</script>

{#if progress}
	{#if viewerPending}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span
			class="inline-flex max-w-full"
			role="presentation"
			onclick={(event) => event.stopPropagation()}
			onpointerdown={(event) => event.stopPropagation()}
			onmousedown={(event) => event.stopPropagation()}
		>
			<a
				href={loanSigningPagePath(loan.id)}
				class="inline-flex max-w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				title="Sign contract"
				aria-label="Pending sign"
				onclick={(event) => event.stopPropagation()}
				onpointerdown={(event) => event.stopPropagation()}
				onmousedown={(event) => event.stopPropagation()}
			>
				<Badge
					variant="outline"
					class={cn(pendingBadgeClass, 'transition-colors hover:bg-destructive/10')}
				>
					<PenLine class="size-3 shrink-0" aria-hidden="true" />
					Pending sign
				</Badge>
			</a>
		</span>
	{:else if openContractDetails}
		<button
			type="button"
			class="inline-flex max-w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			title="Contract details"
			aria-label={`Contract details (${progressLabel})`}
			onclick={(event) => {
				event.stopPropagation();
				onOpenContractDetails?.();
			}}
			onpointerdown={(event) => event.stopPropagation()}
			onmousedown={(event) => event.stopPropagation()}
		>
			<Badge
				variant="outline"
				class={cn(
					progressBadgeClass,
					'cursor-pointer transition-colors',
					complete ? 'hover:bg-emerald-500/10' : 'hover:bg-amber-500/10'
				)}
			>
				{progressLabel}
			</Badge>
		</button>
	{:else}
		<Badge
			variant="outline"
			class={progressBadgeClass}
			title={complete ? 'All parties signed' : 'Contract signing in progress'}
		>
			{progressLabel}
		</Badge>
	{/if}
{:else if showEmpty}
	<span class={cn('text-xs text-muted-foreground', className)}>—</span>
{/if}
