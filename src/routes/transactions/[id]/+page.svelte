<script lang="ts">
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { formatCurrency, formatDate, formatText } from '$lib/format';
	import { getTransactionDirectionBadge, getTransactionTypeBadge } from '$lib/badge-config';

	function directionBadgeVariant(direction: 'In' | 'Out') {
		const config = getTransactionDirectionBadge(direction);
		return config.variant === 'success' ? 'secondary' : config.variant;
	}

	let { data } = $props();

	const transaction = $derived(data.entity);
	const title = $derived(transaction?.name ?? 'Transaction');
</script>

<svelte:head><title>{title}</title></svelte:head>

<DashboardPage>
	<PageHeader {title}>
		<Button href="/transactions" variant="outline" size="sm">Back</Button>
	</PageHeader>

	{#if transaction}
		<Card.Root>
			<Card.Content class="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
				<div>
					<p class="text-xs text-muted-foreground">Investor</p>
					<p class="font-medium">{formatText(transaction.investor.name)}</p>
				</div>
				<div>
					<p class="text-xs text-muted-foreground">Date</p>
					<p class="font-medium">{formatDate(transaction.date)}</p>
				</div>
				<div>
					<p class="text-xs text-muted-foreground">Type</p>
					<Badge
						variant={getTransactionTypeBadge(transaction.type).variant}
						class={cn('text-[10px]', getTransactionTypeBadge(transaction.type).className)}
					>
						{formatText(transaction.type)}
					</Badge>
				</div>
				<div>
					<p class="text-xs text-muted-foreground">Direction</p>
					<Badge
						variant={directionBadgeVariant(transaction.direction)}
						class={cn('text-[10px]', getTransactionDirectionBadge(transaction.direction).className)}
					>
						{formatText(transaction.direction)}
					</Badge>
				</div>
				<div>
					<p class="text-xs text-muted-foreground">Amount</p>
					<p
						class={cn(
							'font-medium tabular-nums',
							transaction.direction === 'In' ? 'text-emerald-600' : 'text-rose-600'
						)}
					>
						{transaction.direction === 'In' ? '+' : '-'}
						{formatCurrency(transaction.amount)}
					</p>
				</div>
				<div>
					<p class="text-xs text-muted-foreground">Balance</p>
					<p class="font-medium tabular-nums">{formatCurrency(transaction.balance)}</p>
				</div>
			</Card.Content>
		</Card.Root>

		{#if transaction.notes}
			<Card.Root>
				<Card.Header><Card.Title>Notes</Card.Title></Card.Header>
				<Card.Content class="p-4 text-sm">{transaction.notes}</Card.Content>
			</Card.Root>
		{/if}
	{/if}
</DashboardPage>
