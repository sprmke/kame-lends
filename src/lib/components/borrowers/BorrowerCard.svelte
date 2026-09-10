<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import ActionButtons from '$lib/components/common/ActionButtons.svelte';
	import {
		createCardQuickViewHandler,
		createRowActionItems,
		GRID_CARD_ACTION_PROPS
	} from '$lib/components/common/action-buttons';
	import { formatText } from '$lib/format';
	import type { BorrowerWithLoans } from '$lib/types';

	interface Props {
		borrower: BorrowerWithLoans;
		viewHref?: string;
		onQuickView?: (borrower: BorrowerWithLoans) => void;
		onEdit?: (borrower: BorrowerWithLoans) => void;
		onDelete?: (borrower: BorrowerWithLoans) => void;
	}

	let {
		borrower,
		viewHref = `/borrowers/${borrower.id}`,
		onQuickView,
		onEdit,
		onDelete
	}: Props = $props();

	const actionItems = $derived(
		createRowActionItems({
			onEdit: onEdit ? () => onEdit(borrower) : undefined,
			onDelete: onDelete ? () => onDelete(borrower) : undefined
		})
	);

	const loanCount = $derived(borrower.loans?.length ?? 0);
</script>

<Card.Root class="flex h-full flex-col overflow-hidden transition-colors hover:border-primary/20">
	<Card.Header class="px-3 pt-3 pb-0">
		<Card.Title class="mb-2 truncate text-sm sm:text-base">{formatText(borrower.name)}</Card.Title>
	</Card.Header>
	<Card.Content class="flex-1 space-y-2 px-3 pt-0 pb-2.5">
		<div class="grid grid-cols-2 gap-1.5">
			<div class="dashboard-metric-cell p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Email</p>
				<p class="truncate text-xs font-medium">
					{borrower.email ? formatText(borrower.email) : '-'}
				</p>
			</div>
			<div class="dashboard-metric-cell p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Contact</p>
				<p class="truncate text-xs font-medium">
					{borrower.contactNumber ? formatText(borrower.contactNumber) : '-'}
				</p>
			</div>
			<div class="dashboard-metric-cell col-span-2 p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Loans</p>
				<p class="text-xs font-semibold tabular-nums">{loanCount}</p>
			</div>
		</div>
	</Card.Content>
	<Card.Footer class="border-t px-0 py-0">
		<ActionButtons
			{viewHref}
			{...GRID_CARD_ACTION_PROPS}
			{actionItems}
			onQuickView={createCardQuickViewHandler(
				onQuickView ? () => onQuickView(borrower) : undefined
			)}
		/>
	</Card.Footer>
</Card.Root>
