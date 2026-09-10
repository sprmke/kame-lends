<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import ActionButtons from '$lib/components/common/ActionButtons.svelte';
	import {
		createCardQuickViewHandler,
		GRID_CARD_ACTION_PROPS
	} from '$lib/components/common/action-buttons';
	import { cn } from '$lib/utils';
	import { formatCurrency, formatDateShort, formatText } from '$lib/format';
	import { getTransactionDirectionBadge, getTransactionTypeBadge } from '$lib/badge-config';
	import type { TransactionWithInvestor } from '$lib/types';

	function directionBadgeVariant(direction: TransactionWithInvestor['direction']) {
		const config = getTransactionDirectionBadge(direction);
		return config.variant === 'success' ? 'secondary' : config.variant;
	}

	interface Props {
		transaction: TransactionWithInvestor;
		viewHref?: string;
	}

	let { transaction, viewHref = `/transactions/${transaction.id}` }: Props = $props();
</script>

<Card.Root class="flex h-full flex-col overflow-hidden transition-colors hover:border-primary/20">
	<Card.Header class="px-4 pt-4 pb-1">
		<div class="flex items-start justify-between gap-2">
			<Card.Title class="mb-2 truncate text-sm sm:text-base"
				>{formatText(transaction.name)}</Card.Title
			>
			<div class="flex shrink-0 gap-1">
				<Badge
					variant={getTransactionTypeBadge(transaction.type).variant}
					class={cn('text-[10px]', getTransactionTypeBadge(transaction.type).className)}
				>
					{formatText(transaction.type)}
				</Badge>
				<Badge
					variant={directionBadgeVariant(transaction.direction)}
					class={cn('text-[10px]', getTransactionDirectionBadge(transaction.direction).className)}
				>
					{formatText(transaction.direction)}
				</Badge>
			</div>
		</div>
	</Card.Header>
	<Card.Content class="flex-1 space-y-3 px-4 pt-0 pb-3">
		<div class="grid grid-cols-3 gap-2">
			<div class="rounded-lg bg-muted/50 p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Date</p>
				<p class="text-xs font-medium">{formatDateShort(transaction.date)}</p>
			</div>
			<div class="rounded-lg bg-muted/50 p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Amount</p>
				<p
					class={cn(
						'text-xs font-semibold',
						transaction.direction === 'In' ? 'text-emerald-600' : 'text-rose-600'
					)}
				>
					{transaction.direction === 'In' ? '+' : '-'}
					{formatCurrency(transaction.amount)}
				</p>
			</div>
			<div class="rounded-lg bg-muted/50 p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Investor</p>
				<p class="truncate text-xs font-medium">{formatText(transaction.investor.name)}</p>
			</div>
		</div>
	</Card.Content>
	<Card.Footer class="border-t px-0 py-0">
		<ActionButtons
			{viewHref}
			{...GRID_CARD_ACTION_PROPS}
			onQuickView={createCardQuickViewHandler(() => goto(viewHref))}
		/>
	</Card.Footer>
</Card.Root>
