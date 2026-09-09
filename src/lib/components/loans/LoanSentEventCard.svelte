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
		investors: Array<{ name: string; amount: number }>;
		totalAmount: number;
		size?: 'sm' | 'md' | 'lg';
		isFuture?: boolean;
	}

	let {
		loan,
		onclick,
		formatCurrency,
		investors,
		totalAmount,
		size = 'md',
		isFuture = false
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
		isFuture ? 'border-amber-300 text-amber-500' : 'border-rose-400 text-rose-500'
	);
</script>

<button
	type="button"
	{onclick}
	class="w-full cursor-pointer rounded-md border border-l-4 border-border/60 bg-muted/30 text-left transition-colors hover:border-primary/25 hover:bg-background {classes.container} {colorClasses}"
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
			<div class="space-y-0.5 text-gray-700 {classes.investor}">
				{#each investors as inv, idx (idx)}
					<div class="flex items-start gap-1">
						<span class="font-bold {isFuture ? 'text-amber-500' : 'text-rose-500'}">•</span>
						<span class="truncate">
							<span class="font-semibold">{formatText(inv.name)}:</span>
							{formatCurrency(inv.amount)}
						</span>
					</div>
				{/each}
			</div>
		</div>
		<div class="border-t pt-2 font-bold text-rose-600 dark:text-rose-400 {classes.total}">
			-{formatCurrency(totalAmount)}
		</div>
	</div>
</button>
