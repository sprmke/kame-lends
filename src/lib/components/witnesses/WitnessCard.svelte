<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import GridListCardShell from '$lib/components/common/GridListCardShell.svelte';
	import { createRowActionItems } from '$lib/components/common/action-buttons';
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

<GridListCardShell
	{viewHref}
	{actionItems}
	onQuickView={onQuickView ? () => onQuickView(witness) : undefined}
>
	{#snippet header()}
		<Card.Title class="mb-2 truncate text-sm sm:text-base">{formatText(witness.name)}</Card.Title>
	{/snippet}
	{#snippet children()}
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
	{/snippet}
</GridListCardShell>
