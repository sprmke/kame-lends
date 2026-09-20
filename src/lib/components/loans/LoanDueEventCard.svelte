<script lang="ts">
	import { formatText } from '$lib/format';
	import type { LoanWithInvestors } from '$lib/types';
	import LoanEventCardMetaBadges from '$lib/components/loans/LoanEventCardMetaBadges.svelte';

	interface Props {
		loan: LoanWithInvestors;
		onclick: () => void;
		formatCurrency: (amount: number) => string;
		totalPrincipal: number;
		totalInterest: number;
		totalAmount: number;
		size?: 'sm' | 'md' | 'lg';
		showHeaderBadges?: boolean;
		onOpenContractDetails?: () => void;
	}

	let {
		loan,
		onclick,
		formatCurrency,
		totalPrincipal,
		totalInterest,
		totalAmount,
		size = 'md',
		showHeaderBadges = true,
		onOpenContractDetails
	}: Props = $props();

	const sizeClasses = {
		sm: {
			container: 'p-2 text-xs',
			badge: 'text-[8px] h-3.5 px-1 py-0',
			title: 'text-[11px]',
			detail: 'text-[10px]',
			total: 'text-[11px]'
		},
		md: {
			container: 'p-3 text-sm',
			badge: 'text-[8px] h-3.5 px-1 py-0',
			title: 'text-sm',
			detail: 'text-xs',
			total: 'text-sm'
		},
		lg: {
			container: 'p-3 text-sm',
			badge: 'text-[8px] h-3.5 px-1 py-0',
			title: 'text-sm',
			detail: 'text-xs',
			total: 'text-sm'
		}
	};

	const classes = $derived(sizeClasses[size]);
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
	class="w-full min-w-0 cursor-pointer rounded-md border border-border/60 bg-muted/30 text-left transition-colors hover:border-primary/25 hover:bg-background {classes.container}"
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
			<div class="space-y-0.5 text-muted-foreground {classes.detail}">
				<div
					class="flex min-w-0 items-center gap-1 {size === 'sm' ? '' : 'justify-between'}"
				>
					<span class="shrink-0 font-medium">Principal:</span>
					<span class="truncate font-semibold tabular-nums">{formatCurrency(totalPrincipal)}</span>
				</div>
				<div
					class="flex min-w-0 items-center gap-1 {size === 'sm' ? '' : 'justify-between'}"
				>
					<span class="shrink-0 font-medium">Interest:</span>
					<span class="truncate font-semibold tabular-nums">{formatCurrency(totalInterest)}</span>
				</div>
			</div>
		</div>
		<div
			class="truncate border-t pt-2 font-bold text-emerald-600 tabular-nums dark:text-emerald-400 {classes.total}"
		>
			+{formatCurrency(totalAmount)}
		</div>
	</div>
</div>
