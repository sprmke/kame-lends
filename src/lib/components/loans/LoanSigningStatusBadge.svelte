<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { loanContractPagePath, loanSigningDisplayStatus } from '$lib/loan-signing';
	import { cn } from '$lib/utils';
	import type { LoanWithInvestors } from '$lib/types';
	import { Check, PenLine } from 'lucide-svelte';

	interface Props {
		loan: LoanWithInvestors;
		class?: string;
		/** Table column: show em dash when no signing invitations. */
		showEmpty?: boolean;
	}

	let { loan, class: className, showEmpty = false }: Props = $props();

	const status = $derived(loanSigningDisplayStatus(loan));
</script>

{#if status === 'pending'}
	<a
		href={loanContractPagePath(loan.id)}
		class="inline-flex max-w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		title="Open contract"
		aria-label="Open contract signing"
		onclick={(event) => event.stopPropagation()}
	>
		<Badge
			variant="outline"
			class={cn(
				'gap-1 border-amber-500/45 text-[10px] text-amber-800 transition-colors hover:bg-amber-500/10 dark:text-amber-300',
				className
			)}
		>
			<PenLine class="size-3 shrink-0" aria-hidden="true" />
			Pending sign
		</Badge>
	</a>
{:else if status === 'signed'}
	<Badge
		variant="outline"
		class={cn(
			'gap-1 border-emerald-500/45 text-[10px] text-emerald-800 dark:text-emerald-300',
			className
		)}
		title="All parties signed"
	>
		<Check class="size-3 shrink-0" aria-hidden="true" />
		Fully signed
	</Badge>
{:else if showEmpty}
	<span class={cn('text-xs text-muted-foreground', className)}>—</span>
{/if}
