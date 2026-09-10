<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import ActionButtons from '$lib/components/common/ActionButtons.svelte';
	import {
		createCardQuickViewHandler,
		createRowActionItems,
		GRID_CARD_ACTION_PROPS
	} from '$lib/components/common/action-buttons';
	import { formatText } from '$lib/format';
	import { countWitnessedLoans } from '$lib/witness-loans';
	import type { WitnessWithLoans } from '$lib/types';

	interface Props {
		witness: WitnessWithLoans;
		viewHref?: string;
		onQuickView?: (witness: WitnessWithLoans) => void;
		onEdit?: (witness: WitnessWithLoans) => void;
		onDelete?: (witness: WitnessWithLoans) => void;
	}

	let {
		witness,
		viewHref = `/witnesses/${witness.id}`,
		onQuickView,
		onEdit,
		onDelete
	}: Props = $props();

	const actionItems = $derived(
		createRowActionItems({
			onEdit: onEdit ? () => onEdit(witness) : undefined,
			onDelete: onDelete ? () => onDelete(witness) : undefined
		})
	);

	const loanCount = $derived(countWitnessedLoans(witness));
</script>

<Card.Root class="flex h-full flex-col overflow-hidden transition-colors hover:border-primary/20">
	<Card.Header class="px-3 pt-3 pb-0">
		<Card.Title class="mb-2 truncate text-sm sm:text-base">{formatText(witness.name)}</Card.Title>
	</Card.Header>
	<Card.Content class="flex-1 space-y-2 px-3 pt-0 pb-2.5">
		<div class="grid grid-cols-2 gap-1.5">
			<div class="dashboard-metric-cell p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Email</p>
				<p class="truncate text-xs font-medium">
					{witness.email ? formatText(witness.email) : '-'}
				</p>
			</div>
			<div class="dashboard-metric-cell p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Contact</p>
				<p class="truncate text-xs font-medium">
					{witness.contactNumber ? formatText(witness.contactNumber) : '-'}
				</p>
			</div>
			<div class="dashboard-metric-cell col-span-2 p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Witnessed Loans</p>
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
				onQuickView ? () => onQuickView(witness) : undefined
			)}
		/>
	</Card.Footer>
</Card.Root>
