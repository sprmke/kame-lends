<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import Pagination from '$lib/components/common/Pagination.svelte';
	import DataTableCard from '$lib/components/common/DataTableCard.svelte';
	import SortableTableHead from '$lib/components/common/SortableTableHead.svelte';
	import TableActionsHead from '$lib/components/common/TableActionsHead.svelte';
	import ActionButtons from '$lib/components/common/ActionButtons.svelte';
	import { createRowActionItems } from '$lib/components/common/action-buttons';
	import { formatText } from '$lib/format';
	import TableEmptyRow from '$lib/components/common/TableEmptyRow.svelte';
	import { TABLE_COL_ACTIONS, TABLE_COL_NAME, TABLE_COL_NUMERIC, TABLE_ROW_CLICKABLE } from '$lib/table-styles';
	import { cn } from '$lib/utils';
	import type { BorrowerWithLoans } from '$lib/types';

	type SortDirection = 'asc' | 'desc';
	type SortField = 'name' | 'email' | 'contactNumber' | 'loanCount';

	interface Props {
		borrowers: BorrowerWithLoans[];
		itemsPerPage?: number;
		onQuickView?: (borrower: BorrowerWithLoans) => void;
		onEdit?: (borrower: BorrowerWithLoans) => void;
		onDelete?: (borrower: BorrowerWithLoans) => void;
		emptyMessage?: string;
	}

	let {
		borrowers,
		itemsPerPage: initialItemsPerPage = 10,
		emptyMessage = 'No borrowers found.',
		onQuickView,
		onEdit,
		onDelete
	}: Props = $props();

	let sortField = $state<SortField | null>(null);
	let sortDirection = $state<SortDirection>('asc');
	let currentPage = $state(1);
	let itemsPerPage = $state(initialItemsPerPage);

	function loanCount(borrower: BorrowerWithLoans) {
		return borrower.loans?.length ?? 0;
	}

	const sortedBorrowers = $derived.by(() => {
		if (!sortField) return borrowers;
		const field = sortField;
		const sorted = [...borrowers];
		sorted.sort((a, b) => {
			let comparison = 0;
			switch (field) {
				case 'name':
					comparison = a.name.localeCompare(b.name);
					break;
				case 'email':
					comparison = (a.email ?? '').localeCompare(b.email ?? '');
					break;
				case 'contactNumber':
					comparison = (a.contactNumber ?? '').localeCompare(b.contactNumber ?? '');
					break;
				case 'loanCount':
					comparison = loanCount(a) - loanCount(b);
					break;
			}
			return sortDirection === 'asc' ? comparison : -comparison;
		});
		return sorted;
	});

	const totalPages = $derived(Math.max(1, Math.ceil(sortedBorrowers.length / itemsPerPage)));
	const paginated = $derived(
		sortedBorrowers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
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
		{ field: 'contactNumber', label: 'Contact', className: 'hidden lg:table-cell' },
		{ field: 'loanCount', label: 'Loans', align: 'right' }
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
				{#each paginated as borrower (borrower.id)}
					<Table.Row class={TABLE_ROW_CLICKABLE} onclick={() => onQuickView?.(borrower)}>
						<Table.Cell>
							<p class={cn('truncate', TABLE_COL_NAME)} title={formatText(borrower.name)}>
								{formatText(borrower.name)}
							</p>
						</Table.Cell>
						<Table.Cell class="hidden truncate md:table-cell">
							{borrower.email ? formatText(borrower.email) : '-'}
						</Table.Cell>
						<Table.Cell class="hidden truncate lg:table-cell">
							{borrower.contactNumber ? formatText(borrower.contactNumber) : '-'}
						</Table.Cell>
						<Table.Cell class={TABLE_COL_NUMERIC}>{loanCount(borrower)}</Table.Cell>
						<Table.Cell class={TABLE_COL_ACTIONS} onclick={(event) => event.stopPropagation()}>
							<ActionButtons
								viewHref="/borrowers/{borrower.id}"
								showView={false}
								actionItems={createRowActionItems({
									onEdit: onEdit ? () => onEdit(borrower) : undefined,
									onDelete: onDelete ? () => onDelete(borrower) : undefined
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
			endIndex={Math.min(currentPage * itemsPerPage, sortedBorrowers.length)}
			totalItems={sortedBorrowers.length}
			itemName="borrowers"
			{itemsPerPage}
			onItemsPerPageChange={(value) => {
				itemsPerPage = value;
				currentPage = 1;
			}}
		/>
	{/snippet}
</DataTableCard>
