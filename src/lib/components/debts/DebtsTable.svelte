<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import Pagination from '$lib/components/common/Pagination.svelte';
	import ActionButtons from '$lib/components/common/ActionButtons.svelte';
	import { createRowActionItems } from '$lib/components/common/action-buttons';
	import { formatCurrencyCompact, formatDateVeryShort, formatText } from '$lib/format';
	import { cn } from '$lib/utils';
	import { ArrowUpDown } from 'lucide-svelte';
	import type { DebtWithInvestor } from '$lib/types';

	type SortDirection = 'asc' | 'desc';
	type SortField = 'date' | 'name' | 'investor' | 'amount' | 'interestRate' | 'interestInterval';

	interface Props {
		debts: DebtWithInvestor[];
		itemsPerPage?: number;
		onQuickView?: (debt: DebtWithInvestor) => void;
		onEdit?: (debt: DebtWithInvestor) => void;
		onDelete?: (debt: DebtWithInvestor) => void;
	}

	let {
		debts,
		itemsPerPage: initialItemsPerPage = 10,
		onQuickView,
		onEdit,
		onDelete
	}: Props = $props();

	let sortField = $state<SortField | null>(null);
	let sortDirection = $state<SortDirection>('asc');
	let currentPage = $state(1);
	let itemsPerPage = $state(initialItemsPerPage);

	const sortedDebts = $derived.by(() => {
		if (!sortField) return debts;
		const sorted = [...debts];
		sorted.sort((a, b) => {
			let comparison = 0;
			switch (sortField) {
				case 'date':
					comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
					break;
				case 'name':
					comparison = a.name.localeCompare(b.name);
					break;
				case 'investor':
					comparison = a.investor.name.localeCompare(b.investor.name);
					break;
				case 'amount':
					comparison = parseFloat(a.amount) - parseFloat(b.amount);
					break;
				case 'interestRate':
					comparison = parseFloat(a.interestRate) - parseFloat(b.interestRate);
					break;
				case 'interestInterval':
					comparison = a.interestInterval.localeCompare(b.interestInterval);
					break;
			}
			return sortDirection === 'asc' ? comparison : -comparison;
		});
		return sorted;
	});

	const totalPages = $derived(Math.max(1, Math.ceil(sortedDebts.length / itemsPerPage)));
	const paginated = $derived(
		sortedDebts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
	);

	$effect(() => {
		if (currentPage > totalPages) currentPage = totalPages;
	});

	function handleSort(field: SortField) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	}

	const columns: Array<{ field: SortField; label: string; className?: string }> = [
		{ field: 'date', label: 'Start Date' },
		{ field: 'name', label: 'Name' },
		{ field: 'investor', label: 'Investor', className: 'hidden md:table-cell' },
		{ field: 'amount', label: 'Principal' },
		{ field: 'interestRate', label: 'Rate', className: 'hidden lg:table-cell' },
		{ field: 'interestInterval', label: 'Period', className: 'hidden xl:table-cell' }
	];
</script>

<div class="space-y-4">
	<div class="overflow-hidden rounded-xl border border-border/50">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					{#each columns as column}
						<Table.Head class={column.className}>
							<button
								type="button"
								class="inline-flex items-center gap-1 font-medium hover:text-foreground"
								onclick={() => handleSort(column.field)}
							>
								{column.label}
								<ArrowUpDown
									class={cn(
										'h-3.5 w-3.5',
										sortField === column.field ? 'text-foreground' : 'text-muted-foreground/50'
									)}
								/>
							</button>
						</Table.Head>
					{/each}
					<Table.Head class="text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each paginated as debt (debt.id)}
					<Table.Row class="cursor-pointer" onclick={() => onQuickView?.(debt)}>
						<Table.Cell>{formatDateVeryShort(debt.date)}</Table.Cell>
						<Table.Cell>
							<p class="truncate font-medium" title={formatText(debt.name)}>
								{formatText(debt.name)}
							</p>
						</Table.Cell>
						<Table.Cell class="hidden truncate md:table-cell">
							{formatText(debt.investor.name)}
						</Table.Cell>
						<Table.Cell class="font-medium tabular-nums">
							{formatCurrencyCompact(debt.amount)}
						</Table.Cell>
						<Table.Cell class="hidden tabular-nums lg:table-cell">{debt.interestRate}%</Table.Cell>
						<Table.Cell class="hidden xl:table-cell">
							<Badge variant="secondary" class="text-[10px]">{debt.interestInterval}</Badge>
						</Table.Cell>
						<Table.Cell class="text-right">
							<ActionButtons
								viewHref="/debts/{debt.id}"
								showView={false}
								onQuickView={onQuickView
									? (event) => {
											event.preventDefault();
											event.stopPropagation();
											onQuickView(debt);
										}
									: undefined}
								actionItems={createRowActionItems({
									onEdit: onEdit ? () => onEdit(debt) : undefined,
									onDelete: onDelete ? () => onDelete(debt) : undefined
								})}
							/>
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
		itemName="borrowings"
	/>
</div>
