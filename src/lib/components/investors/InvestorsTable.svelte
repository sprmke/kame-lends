<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import Pagination from '$lib/components/common/Pagination.svelte';
	import DataTableCard from '$lib/components/common/DataTableCard.svelte';
	import SortableTableHead from '$lib/components/common/SortableTableHead.svelte';
	import TableActionsHead from '$lib/components/common/TableActionsHead.svelte';
	import ActionButtons from '$lib/components/common/ActionButtons.svelte';
	import { createRowActionItems } from '$lib/components/common/action-buttons';
	import { formatCurrencyCompact, formatPercentage, formatText } from '$lib/format';
	import { calculateAverageRate, calculateInvestorStats } from '$lib/calculations';
	import TableEmptyRow from '$lib/components/common/TableEmptyRow.svelte';
	import {
		TABLE_COL_ACTIONS,
		TABLE_COL_NAME,
		TABLE_COL_NUMERIC,
		TABLE_ROW_CLICKABLE
	} from '$lib/table-styles';
	import { cn } from '$lib/utils';
	import type { InvestorWithLoans } from '$lib/types';

	type SortDirection = 'asc' | 'desc';
	type SortField =
		| 'name'
		| 'email'
		| 'totalCapital'
		| 'avgRate'
		| 'totalInterest'
		| 'totalAmount';

	interface Props {
		investors: InvestorWithLoans[];
		itemsPerPage?: number;
		onQuickView?: (investor: InvestorWithLoans) => void;
		onEdit?: (investor: InvestorWithLoans) => void;
		onDelete?: (investor: InvestorWithLoans) => void;
		emptyMessage?: string;
	}

	let {
		investors,
		itemsPerPage: initialItemsPerPage = 10,
		emptyMessage = 'No investors found.',
		onQuickView,
		onEdit,
		onDelete
	}: Props = $props();

	let sortField = $state<SortField | null>(null);
	let sortDirection = $state<SortDirection>('asc');
	let currentPage = $state(1);
	let itemsPerPage = $state(initialItemsPerPage);

	function getStats(investor: InvestorWithLoans) {
		return calculateInvestorStats(investor);
	}

	function getSortValue(investor: InvestorWithLoans, field: SortField): string | number {
		const stats = getStats(investor);
		const avgRate = calculateAverageRate(investor.loanInvestors);
		switch (field) {
			case 'name':
				return investor.name.toLowerCase();
			case 'email':
				return investor.email.toLowerCase();
			case 'totalCapital':
				return stats.totalCapital;
			case 'avgRate':
				return avgRate;
			case 'totalInterest':
				return stats.totalInterest;
			case 'totalAmount':
				return stats.totalCapital + stats.totalInterest;
		}
	}

	const sortedInvestors = $derived.by(() => {
		if (!sortField) return investors;
		const field = sortField;
		const sorted = [...investors];
		sorted.sort((a, b) => {
			const aValue = getSortValue(a, field);
			const bValue = getSortValue(b, field);
			let comparison;
			if (typeof aValue === 'string' && typeof bValue === 'string') {
				comparison = aValue.localeCompare(bValue);
			} else {
				comparison = Number(aValue) - Number(bValue);
			}
			return sortDirection === 'asc' ? comparison : -comparison;
		});
		return sorted;
	});

	const totalPages = $derived(Math.max(1, Math.ceil(sortedInvestors.length / itemsPerPage)));
	const paginated = $derived(
		sortedInvestors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
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
		{ field: 'name', label: 'Name' },
		{ field: 'email', label: 'Email', className: 'hidden md:table-cell' },
		{ field: 'totalCapital', label: 'Capital', align: 'right' },
		{ field: 'avgRate', label: 'Rate', className: 'hidden lg:table-cell', align: 'right' },
		{ field: 'totalInterest', label: 'Interest', className: 'hidden xl:table-cell', align: 'right' },
		{ field: 'totalAmount', label: 'Amount', align: 'right' }
	];
</script>

<DataTableCard>
	{#snippet children()}
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
				{#each paginated as investor (investor.id)}
					{@const stats = getStats(investor)}
					{@const avgRate = calculateAverageRate(investor.loanInvestors)}
					<Table.Row class={TABLE_ROW_CLICKABLE} onclick={() => onQuickView?.(investor)}>
						<Table.Cell>
							<p class={cn('truncate', TABLE_COL_NAME)} title={formatText(investor.name)}>
								{formatText(investor.name)}
							</p>
						</Table.Cell>
						<Table.Cell class="hidden truncate md:table-cell">
							{formatText(investor.email)}
						</Table.Cell>
						<Table.Cell class={TABLE_COL_NUMERIC}>
							{formatCurrencyCompact(stats.totalCapital)}
						</Table.Cell>
						<Table.Cell class={cn('hidden lg:table-cell', TABLE_COL_NUMERIC)}>
							{formatPercentage(avgRate)}
						</Table.Cell>
						<Table.Cell class={cn('hidden xl:table-cell', TABLE_COL_NUMERIC)}>
							{formatCurrencyCompact(stats.totalInterest)}
						</Table.Cell>
						<Table.Cell class={TABLE_COL_NUMERIC}>
							{formatCurrencyCompact(stats.totalCapital + stats.totalInterest)}
						</Table.Cell>
						<Table.Cell class={TABLE_COL_ACTIONS} onclick={(event) => event.stopPropagation()}>
							<ActionButtons
								viewHref="/investors/{investor.id}"
								showView={false}
								actionItems={createRowActionItems({
									onEdit: onEdit ? () => onEdit(investor) : undefined,
									onDelete: onDelete ? () => onDelete(investor) : undefined
								})}
							/>
						</Table.Cell>
					</Table.Row>
				{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	{/snippet}
	{#snippet footer()}
		<Pagination
			embedded
			{currentPage}
			{totalPages}
			onPageChange={(page) => (currentPage = page)}
			startIndex={(currentPage - 1) * itemsPerPage}
			endIndex={Math.min(currentPage * itemsPerPage, sortedInvestors.length)}
			totalItems={sortedInvestors.length}
			itemName="investors"
			{itemsPerPage}
			onItemsPerPageChange={(value) => {
				itemsPerPage = value;
				currentPage = 1;
			}}
		/>
	{/snippet}
</DataTableCard>
