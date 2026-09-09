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
		totalPrincipal: number;
		totalInterest: number;
		totalAmount: number;
		size?: 'sm' | 'md' | 'lg';
	}

	let {
		loan,
		onclick,
		formatCurrency,
		totalPrincipal,
		totalInterest,
		totalAmount,
		size = 'md'
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

<button
	type="button"
	{onclick}
	class="w-full cursor-pointer rounded-md border border-l-4 border-border/60 border-l-emerald-400 bg-muted/30 text-left transition-colors hover:border-primary/25 hover:bg-background {classes.container}"
>
	<div class="flex flex-col space-y-2">
		<div class="flex space-x-1">
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
		<p class="truncate font-bold text-gray-900 {classes.title}">{formatText(loan.loanName)}</p>
		<div class={size === 'sm' ? 'space-y-1' : 'space-y-1 pl-8'}>
			<div class="space-y-0.5 text-gray-700 {classes.detail}">
				<div class="flex items-center {size === 'sm' ? 'gap-1' : 'justify-between'}">
					<span class="font-medium">Principal:</span>
					<span class="font-semibold">{formatCurrency(totalPrincipal)}</span>
				</div>
				<div class="flex items-center {size === 'sm' ? 'gap-1' : 'justify-between'}">
					<span class="font-medium">Interest:</span>
					<span class="font-semibold">{formatCurrency(totalInterest)}</span>
				</div>
			</div>
		</div>
		<div class="border-t pt-2 font-bold text-emerald-600 dark:text-emerald-400 {classes.total}">
			+{formatCurrency(totalAmount)}
		</div>
	</div>
</button>
