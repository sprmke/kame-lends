<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import ActionButtons from '$lib/components/common/ActionButtons.svelte';
	import TableEmptyRow from '$lib/components/common/TableEmptyRow.svelte';
	import { createLoanActionItems } from '$lib/components/common/action-buttons';
	import { formatCurrency, formatDateVeryShort, formatText, formatPercentage } from '$lib/format';
	import {
		calculateAverageRate,
		calculateLoanStats,
		calculateTotalPrincipal,
		calculateTransactionStats
	} from '$lib/calculations';
	import { getLoanStatusBadge, getLoanTypeBadge } from '$lib/badge-config';
	import { TABLE_ROW_CLICKABLE } from '$lib/table-styles';
	import { cn } from '$lib/utils';
	import type { LoanWithInvestors } from '$lib/types';

	interface Props {
		loans: LoanWithInvestors[];
		enableRowSelection?: boolean;
		selectedRowIds?: Set<string | number>;
		onSelectedRowIdsChange?: (ids: Set<string | number>) => void;
		onQuickView?: (loan: LoanWithInvestors) => void;
		onEdit?: (loan: LoanWithInvestors) => void;
		onAddPayment?: (loan: LoanWithInvestors) => void;
		onAddReceivedPayment?: (loan: LoanWithInvestors) => void;
		onDuplicate?: (loan: LoanWithInvestors) => void;
		onContractDetails?: (loan: LoanWithInvestors) => void;
		onDelete?: (loan: LoanWithInvestors) => void;
		emptyMessage?: string;
		/** When set, Principal shows this investor's allocation on each loan (not full loan principal). */
		investorId?: number;
	}

	let {
		loans,
		enableRowSelection = false,
		emptyMessage = 'No loans found.',
		selectedRowIds = new Set(),
		onSelectedRowIdsChange,
		onQuickView,
		onEdit,
		onAddPayment,
		onAddReceivedPayment,
		onDuplicate,
		onContractDetails,
		onDelete,
		investorId
	}: Props = $props();

	function investorEntriesForLoan(loan: LoanWithInvestors) {
		if (investorId == null) return null;
		return (loan.loanInvestors ?? []).filter(
			(li) => (li.investor?.id ?? li.investorId) === investorId
		);
	}

	function toggleAll(checked: boolean) {
		const next = checked ? new Set(loans.map((l) => l.id)) : new Set<string | number>();
		onSelectedRowIdsChange?.(next);
	}

	function toggleOne(id: number, checked: boolean) {
		const next = new Set(selectedRowIds);
		if (checked) next.add(id);
		else next.delete(id);
		onSelectedRowIdsChange?.(next);
	}
</script>

<div class="overflow-x-auto rounded-md border border-border/60" data-slot="table-container">
	<Table.Root>
		<Table.Header>
			<Table.Row>
				{#if enableRowSelection}
					<Table.Head class="w-10">
						<Checkbox
							checked={loans.length > 0 && selectedRowIds.size === loans.length}
							onCheckedChange={(v) => toggleAll(!!v)}
							aria-label="Select all"
						/>
					</Table.Head>
				{/if}
				<Table.Head>Loan</Table.Head>
				<Table.Head class="hidden md:table-cell">Type</Table.Head>
				<Table.Head class="hidden lg:table-cell">Status</Table.Head>
				<Table.Head class="text-right">Principal</Table.Head>
				<Table.Head class="hidden md:table-cell text-right">Due</Table.Head>
				<Table.Head class="w-28 text-right">Actions</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#if loans.length === 0}
				<TableEmptyRow
					colspan={enableRowSelection ? 8 : 7}
					message={emptyMessage}
				/>
			{:else}
			{#each loans as loan (loan.id)}
				{@const scopedEntries = investorEntriesForLoan(loan)}
				{@const principal =
					scopedEntries != null
						? calculateTotalPrincipal(scopedEntries)
						: calculateLoanStats(loan).totalPrincipal}
				{@const averageRate =
					scopedEntries != null
						? calculateAverageRate(scopedEntries)
						: calculateTransactionStats(loan.loanInvestors).averageRate}
				<Table.Row
					class={cn(onQuickView && TABLE_ROW_CLICKABLE)}
					onclick={() => onQuickView?.(loan)}
				>
					{#if enableRowSelection}
						<Table.Cell onclick={(e) => e.stopPropagation()}>
							<Checkbox
								checked={selectedRowIds.has(loan.id)}
								onCheckedChange={(v) => toggleOne(loan.id, !!v)}
								aria-label="Select loan"
							/>
						</Table.Cell>
					{/if}
					<Table.Cell>
						<div class="min-w-0">
							<p class="truncate font-medium">{formatText(loan.loanName)}</p>
							<p class="truncate text-xs text-muted-foreground md:hidden">
								{formatText(loan.status)}
							</p>
						</div>
					</Table.Cell>
					<Table.Cell class="hidden md:table-cell">
						<Badge
							variant={getLoanTypeBadge(loan.type).variant}
							class={cn('text-[10px]', getLoanTypeBadge(loan.type).className)}
						>
							{formatText(loan.type)}
						</Badge>
					</Table.Cell>
					<Table.Cell class="hidden lg:table-cell">
						<Badge
							variant={getLoanStatusBadge(loan.status).variant}
							class={cn('text-[10px]', getLoanStatusBadge(loan.status).className)}
						>
							{formatText(loan.status)}
						</Badge>
					</Table.Cell>
					<Table.Cell class="text-right tabular-nums">
						{formatCurrency(principal)}
						{#if principal > 0}
							<p class="text-[10px] text-muted-foreground">
								{formatPercentage(averageRate)}
							</p>
						{/if}
					</Table.Cell>
					<Table.Cell class="hidden md:table-cell text-right text-xs text-muted-foreground">
						{loan.dueDate ? formatDateVeryShort(loan.dueDate) : '—'}
					</Table.Cell>
					<Table.Cell onclick={(e) => e.stopPropagation()}>
						<ActionButtons
							viewHref={`/loans/${loan.id}`}
							showView={false}
							actionItems={createLoanActionItems({
								onEdit: onEdit ? () => onEdit(loan) : undefined,
								onAddPayment: onAddPayment ? () => onAddPayment(loan) : undefined,
								onAddReceivedPayment: onAddReceivedPayment
									? () => onAddReceivedPayment(loan)
									: undefined,
								onDuplicate: onDuplicate ? () => onDuplicate(loan) : undefined,
								showDuplicate: Boolean(onDuplicate),
								onContractDetails: onContractDetails
									? () => onContractDetails(loan)
									: undefined,
								onDelete: onDelete ? () => onDelete(loan) : undefined
							})}
						/>
					</Table.Cell>
				</Table.Row>
			{/each}
			{/if}
		</Table.Body>
	</Table.Root>
</div>
