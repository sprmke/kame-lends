<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { getLoanStatusBadge, getLoanTypeBadge } from '$lib/badge-config';
	import { formatText } from '$lib/format';
	import { cn } from '$lib/utils';
	import type { LoanWithInvestors } from '$lib/types';

	interface Props {
		loan: LoanWithInvestors;
		onclick: () => void;
		formatCurrency: (amount: number) => string;
		investorName: string;
		principal: number;
		interest: number;
		totalAmount: number;
		size?: 'sm' | 'md' | 'lg';
	}

	let {
		loan,
		onclick,
		formatCurrency,
		investorName,
		principal,
		interest,
		totalAmount,
		size = 'md'
	}: Props = $props();

	const sizeClasses = {
		sm: {
			container: 'p-2 text-xs',
			badge: 'text-[8px] h-3.5 px-1 py-0',
			title: 'text-[11px]',
			detail: 'text-[10px]',
			total: 'text-[11px] px-1.5 py-0.5'
		},
		md: {
			container: 'p-3 text-sm',
			badge: 'text-[8px] h-3.5 px-1 py-0',
			title: 'text-sm',
			detail: 'text-xs',
			total: 'text-sm px-2 py-1'
		},
		lg: {
			container: 'p-3 text-sm',
			badge: 'text-[8px] h-3.5 px-1 py-0',
			title: 'text-sm',
			detail: 'text-xs',
			total: 'text-sm px-2 py-1'
		}
	};

	const classes = $derived(sizeClasses[size]);
</script>

<button
	type="button"
	{onclick}
	class="w-full min-w-0 cursor-pointer rounded-md border border-border/60 bg-muted/30 text-left transition-colors hover:border-primary/25 hover:bg-background {classes.container}"
>
	<div class="min-w-0 space-y-2">
		<div class="flex items-center gap-2">
			<div class="min-w-0 flex-1 space-y-1">
				<div class="flex flex-wrap gap-1">
					<Badge
						variant={getLoanTypeBadge(loan.type).variant}
						class={cn(classes.badge, 'leading-none', getLoanTypeBadge(loan.type).className)}
					>
						{formatText(loan.type)}
					</Badge>
					<Badge
						variant={getLoanStatusBadge(loan.status).variant}
						class={cn(classes.badge, 'leading-none', getLoanStatusBadge(loan.status).className)}
					>
						{formatText(loan.status)}
					</Badge>
				</div>
				<div class="truncate font-bold text-foreground {classes.title}">
					{formatText(loan.loanName)}
				</div>
			</div>
		</div>
		<div class={size === 'sm' ? 'space-y-1' : 'space-y-1 pl-8'}>
			<div class="truncate font-semibold text-muted-foreground {classes.detail}">
				{formatText(investorName)}
			</div>
			<div
				class="max-w-full truncate rounded bg-card/80 font-bold text-foreground tabular-nums {classes.total}"
			>
				Interest Due: {formatCurrency(totalAmount)}
			</div>
			<div class="space-y-0.5 text-muted-foreground {classes.detail}">
				<div
					class="flex min-w-0 items-center gap-1 {size === 'sm' ? '' : 'justify-between'}"
				>
					<span class="shrink-0 font-medium">Principal:</span>
					<span class="truncate font-semibold tabular-nums">{formatCurrency(principal)}</span>
				</div>
				<div
					class="flex min-w-0 items-center gap-1 {size === 'sm' ? '' : 'justify-between'}"
				>
					<span class="shrink-0 font-medium">Interest:</span>
					<span class="truncate font-semibold tabular-nums">{formatCurrency(interest)}</span>
				</div>
			</div>
		</div>
	</div>
</button>
