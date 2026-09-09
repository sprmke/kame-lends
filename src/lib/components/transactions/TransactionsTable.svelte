<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import Pagination from '$lib/components/common/Pagination.svelte';
	import { cn } from '$lib/utils';
	import { formatCurrencyCompact, formatDateVeryShort, formatText } from '$lib/format';
	import { getTransactionDirectionBadge, getTransactionTypeBadge } from '$lib/badge-config';
	import type { TransactionWithInvestor } from '$lib/types';

	function directionBadgeVariant(direction: TransactionWithInvestor['direction']) {
		const config = getTransactionDirectionBadge(direction);
		return config.variant === 'success' ? 'secondary' : config.variant;
	}

	interface Props {
		transactions: TransactionWithInvestor[];
		itemsPerPage?: number;
	}

	let { transactions, itemsPerPage = 10 }: Props = $props();

	let currentPage = $state(1);
	const totalPages = $derived(Math.max(1, Math.ceil(transactions.length / itemsPerPage)));
	const paginated = $derived(
		transactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
	);

	$effect(() => {
		if (currentPage > totalPages) currentPage = totalPages;
	});
</script>

<div class="space-y-4">
	<div class="overflow-hidden rounded-xl border border-border/50">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Date</Table.Head>
					<Table.Head>Name</Table.Head>
					<Table.Head class="hidden md:table-cell">Investor</Table.Head>
					<Table.Head class="hidden lg:table-cell">Type</Table.Head>
					<Table.Head>Direction</Table.Head>
					<Table.Head>Amount</Table.Head>
					<Table.Head class="text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each paginated as transaction (transaction.id)}
					<Table.Row
						class="cursor-pointer"
						onclick={() => (window.location.href = `/transactions/${transaction.id}`)}
					>
						<Table.Cell>{formatDateVeryShort(transaction.date)}</Table.Cell>
						<Table.Cell>
							<p class="truncate font-medium" title={formatText(transaction.name)}>
								{formatText(transaction.name)}
							</p>
						</Table.Cell>
						<Table.Cell class="hidden truncate md:table-cell">
							{formatText(transaction.investor.name)}
						</Table.Cell>
						<Table.Cell class="hidden lg:table-cell">
							<Badge
								variant={getTransactionTypeBadge(transaction.type).variant}
								class={cn('text-[10px]', getTransactionTypeBadge(transaction.type).className)}
							>
								{formatText(transaction.type)}
							</Badge>
						</Table.Cell>
						<Table.Cell>
							<Badge
								variant={directionBadgeVariant(transaction.direction)}
								class={cn(
									'text-[10px]',
									getTransactionDirectionBadge(transaction.direction).className
								)}
							>
								{formatText(transaction.direction)}
							</Badge>
						</Table.Cell>
						<Table.Cell
							class={cn(
								'font-medium tabular-nums',
								transaction.direction === 'In' ? 'text-emerald-600' : 'text-rose-600'
							)}
						>
							{transaction.direction === 'In' ? '+' : '-'}
							{formatCurrencyCompact(transaction.amount)}
						</Table.Cell>
						<Table.Cell class="text-right" onclick={(e) => e.stopPropagation()}>
							<Button href="/transactions/{transaction.id}" variant="outline" size="sm">Open</Button
							>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>

	<Pagination
		{currentPage}
		{totalPages}
		onPageChange={(page) => (currentPage = page)}
		itemName="transactions"
	/>
</div>
