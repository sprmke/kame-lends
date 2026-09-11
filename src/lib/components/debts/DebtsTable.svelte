<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import Pagination from '$lib/components/common/Pagination.svelte';
	import DataTableCard from '$lib/components/common/DataTableCard.svelte';
	import SortableTableHead from '$lib/components/common/SortableTableHead.svelte';
	import TableActionsHead from '$lib/components/common/TableActionsHead.svelte';
	import ActionButtons from '$lib/components/common/ActionButtons.svelte';
	import { createRowActionItems } from '$lib/components/common/action-buttons';
	import { formatCurrencyCompact, formatDateVeryShort, formatText } from '$lib/format';
	import TableEmptyRow from '$lib/components/common/TableEmptyRow.svelte';
	import { TABLE_COL_ACTIONS, TABLE_COL_NAME, TABLE_COL_NUMERIC, TABLE_ROW_CLICKABLE } from '$lib/table-styles';
	import { cn } from '$lib/utils';
	import type { DebtWithInvestor } from '$lib/types';

	type SortDirection = 'asc' | 'desc';
	type SortField = 'date' | 'name' | 'investor' | 'amount' | 'interestRate' | 'interestInterval';

	interface Props {
		debts: DebtWithInvestor[];
		itemsPerPage?: number;
		onQuickView?: (debt: DebtWithInvestor) => void;
		onEdit?: (debt: DebtWithInvestor) => void;
		onDelete?: (debt: DebtWithInvestor) => void;
		emptyMessage?: string;
	}

	let {
		debts,
		itemsPerPage: initialItemsPerPage = 10,
		emptyMessage = 'No borrowings found.',
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

	const columns: Array<{
		field: SortField;
		label: string;
		className?: string;
		align?: 'left' | 'right';
	}> = [
		{ field: 'date', label: 'Start Date' },
		{ field: 'name', label: 'Name' },
		{ field: 'investor', label: 'Investor', className: 'hidden md:table-cell' },
		{ field: 'amount', label: 'Principal', align: 'right' },
		{ field: 'interestRate', label: 'Rate', className: 'hidden lg:table-cell', align: 'right' },
		{ field: 'interestInterval', label: 'Period', className: 'hidden xl:table-cell' }
	];
</script>

<DataTableCard>
		<Table.Root>
			<Table.Header>
				<Table.Row>
					{#each columns as column (column.field)}
						<SortableTableHead
							label={column.label}
							class={column.className}
							align={column.align}
							active={sortField === column.field}
							onclick={() => handleSort(column.field)}
						/>
					{/each}
					<TableActionsHead />
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if paginated.length === 0}
					<TableEmptyRow colspan={columns.length + 1} message={emptyMessage} />
				{:else}
				{#each paginated as debt (debt.id)}
					<Table.Row class={TABLE_ROW_CLICKABLE} onclick={() => onQuickView?.(debt)}>
						<Table.Cell>{formatDateVeryShort(debt.date)}</Table.Cell>
						<Table.Cell>
							<p class={cn('truncate', TABLE_COL_NAME)} title={formatText(debt.name)}>
								{formatText(debt.name)}
							</p>
						</Table.Cell>
						<Table.Cell class="hidden truncate md:table-cell">
							{formatText(debt.investor.name)}
						</Table.Cell>
						<Table.Cell class={TABLE_COL_NUMERIC}>
							{formatCurrencyCompact(debt.amount)}
						</Table.Cell>
						<Table.Cell class={cn('hidden lg:table-cell', TABLE_COL_NUMERIC)}>
							{debt.interestRate}%
						</Table.Cell>
						<Table.Cell class="hidden xl:table-cell">
							<Badge variant="secondary" class="text-[10px]">{debt.interestInterval}</Badge>
						</Table.Cell>
						<Table.Cell
							class={TABLE_COL_ACTIONS}
							onclick={(event) => event.stopPropagation()}
						>
							<ActionButtons
								viewHref="/debts/{debt.id}"
								showView={false}
								actionItems={createRowActionItems({
									onEdit: onEdit ? () => onEdit(debt) : undefined,
									onDelete: onDelete ? () => onDelete(debt) : undefined
								})}
							/>
						</Table.Cell>
					</Table.Row>
				{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	{#snippet footer()}
		<Pagination
			embedded
			{currentPage}
			{totalPages}
			onPageChange={(page) => (currentPage = page)}
			startIndex={(currentPage - 1) * itemsPerPage}
			endIndex={Math.min(currentPage * itemsPerPage, sortedDebts.length)}
			totalItems={sortedDebts.length}
			itemName="borrowings"
			{itemsPerPage}
			onItemsPerPageChange={(value) => {
				itemsPerPage = value;
				currentPage = 1;
			}}
		/>
	{/snippet}
</DataTableCard>
