<script lang="ts">
	import { formatText } from '$lib/format';
	import type { LoanWithInvestors } from '$lib/types';
	import LoanEventCardMetaBadges from '$lib/components/loans/LoanEventCardMetaBadges.svelte';

	interface Props {
		loan: LoanWithInvestors;
		onclick: () => void;
		formatCurrency: (amount: number) => string;
		investors: Array<{ name: string; amount: number }>;
		totalAmount: number;
		size?: 'sm' | 'md' | 'lg';
		isFuture?: boolean;
		showHeaderBadges?: boolean;
		onOpenContractDetails?: () => void;
	}

	let {
		loan,
		onclick,
		formatCurrency,
		investors,
		totalAmount,
		size = 'md',
		isFuture = false,
		showHeaderBadges = true,
		onOpenContractDetails
	}: Props = $props();

	const sizeClasses = {
		sm: {
			container: 'p-2 text-xs',
			badge: 'text-[8px] h-3.5 px-1 py-0',
			title: 'text-[11px]',
			investor: 'text-[10px]',
			total: 'text-[11px]'
		},
		md: {
			container: 'p-3 text-sm',
			badge: 'text-[8px] h-3.5 px-1 py-0',
			title: 'text-sm',
			investor: 'text-xs',
			total: 'text-sm'
		},
		lg: {
			container: 'p-3 text-sm',
			badge: 'text-[8px] h-3.5 px-1 py-0',
			title: 'text-sm',
			investor: 'text-xs',
			total: 'text-sm'
		}
	};

	const classes = $derived(sizeClasses[size]);
	const colorClasses = $derived(
		isFuture ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
	);
</script>

<div
	role="button"
	tabindex="0"
	{onclick}
	onkeydown={(event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onclick();
		}
	}}
	class="w-full min-w-0 cursor-pointer rounded-md border border-border/60 bg-muted/30 text-left transition-colors hover:border-primary/25 hover:bg-background {classes.container} {colorClasses}"
>
	<div class="flex min-w-0 flex-col space-y-2">
		{#if showHeaderBadges}
			<LoanEventCardMetaBadges
				{loan}
				badgeClass={classes.badge}
				showGroupBadges={showHeaderBadges}
				{onOpenContractDetails}
			/>
		{/if}
		<p class="truncate font-bold text-foreground {classes.title}">{formatText(loan.loanName)}</p>
		<div class={size === 'sm' ? 'space-y-1' : 'space-y-1 pl-8'}>
			<div class="space-y-0.5 text-muted-foreground {classes.investor}">
				{#each investors as inv, idx (idx)}
					<div class="flex min-w-0 items-start gap-1">
						<span
							class="shrink-0 font-bold {isFuture
								? 'text-amber-600 dark:text-amber-400'
								: 'text-rose-600 dark:text-rose-400'}">•</span
						>
						<span class="min-w-0 truncate">
							<span class="font-semibold">{formatText(inv.name)}:</span>
							<span class="tabular-nums">{formatCurrency(inv.amount)}</span>
						</span>
					</div>
				{/each}
			</div>
		</div>
		<div
			class="truncate border-t pt-2 font-bold text-rose-600 tabular-nums dark:text-rose-400 {classes.total}"
		>
			-{formatCurrency(totalAmount)}
		</div>
	</div>
</div>
