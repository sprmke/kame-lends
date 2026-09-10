<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import Pagination from '$lib/components/common/Pagination.svelte';
	import DataTableCard from '$lib/components/common/DataTableCard.svelte';
	import SortableTableHead from '$lib/components/common/SortableTableHead.svelte';
	import TableActionsHead from '$lib/components/common/TableActionsHead.svelte';
	import ActionButtons from '$lib/components/common/ActionButtons.svelte';
	import { createRowActionItems } from '$lib/components/common/action-buttons';
	import { formatText } from '$lib/format';
	import { countWitnessedLoans } from '$lib/witness-loans';
	import TableEmptyRow from '$lib/components/common/TableEmptyRow.svelte';
	import { TABLE_COL_ACTIONS, TABLE_COL_NAME, TABLE_COL_NUMERIC, TABLE_ROW_CLICKABLE } from '$lib/table-styles';
	import { cn } from '$lib/utils';
	import type { WitnessWithLoans } from '$lib/types';

	type SortDirection = 'asc' | 'desc';
	type SortField = 'name' | 'email' | 'contactNumber' | 'loanCount';

	interface Props {
		witnesses: WitnessWithLoans[];
		itemsPerPage?: number;
		onQuickView?: (witness: WitnessWithLoans) => void;
		onEdit?: (witness: WitnessWithLoans) => void;
		onDelete?: (witness: WitnessWithLoans) => void;
		emptyMessage?: string;
	}

	let {
		witnesses,
		itemsPerPage: initialItemsPerPage = 10,
		emptyMessage = 'No witnesses found.',
		onQuickView,
		onEdit,
		onDelete
	}: Props = $props();

	let sortField = $state<SortField | null>(null);
	let sortDirection = $state<SortDirection>('asc');
	let currentPage = $state(1);
	let itemsPerPage = $state(initialItemsPerPage);

	const sortedWitnesses = $derived.by(() => {
		if (!sortField) return witnesses;
		const field = sortField;
		const sorted = [...witnesses];
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
					comparison = countWitnessedLoans(a) - countWitnessedLoans(b);
					break;
			}
			return sortDirection === 'asc' ? comparison : -comparison;
		});
		return sorted;
	});

	const totalPages = $derived(Math.max(1, Math.ceil(sortedWitnesses.length / itemsPerPage)));
	const paginated = $derived(
		sortedWitnesses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
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
				{#each paginated as witness (witness.id)}
					<Table.Row class={TABLE_ROW_CLICKABLE} onclick={() => onQuickView?.(witness)}>
						<Table.Cell>
							<p class={cn('truncate', TABLE_COL_NAME)} title={formatText(witness.name)}>
								{formatText(witness.name)}
							</p>
						</Table.Cell>
						<Table.Cell class="hidden truncate md:table-cell">
							{witness.email ? formatText(witness.email) : '-'}
						</Table.Cell>
						<Table.Cell class="hidden truncate lg:table-cell">
							{witness.contactNumber ? formatText(witness.contactNumber) : '-'}
						</Table.Cell>
						<Table.Cell class={TABLE_COL_NUMERIC}>{countWitnessedLoans(witness)}</Table.Cell>
						<Table.Cell class={TABLE_COL_ACTIONS} onclick={(event) => event.stopPropagation()}>
							<ActionButtons
								viewHref="/witnesses/{witness.id}"
								showView={false}
								actionItems={createRowActionItems({
									onEdit: onEdit ? () => onEdit(witness) : undefined,
									onDelete: onDelete ? () => onDelete(witness) : undefined
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
			endIndex={Math.min(currentPage * itemsPerPage, sortedWitnesses.length)}
			totalItems={sortedWitnesses.length}
			itemName="witnesses"
			{itemsPerPage}
			onItemsPerPageChange={(value) => {
				itemsPerPage = value;
				currentPage = 1;
			}}
		/>
	{/snippet}
</DataTableCard>
