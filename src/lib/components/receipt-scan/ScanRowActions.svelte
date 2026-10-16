<script lang="ts">
	import { Combine, MoreVertical, Split, Trash2 } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import ResponsiveOverflowMenu from '$lib/components/common/ResponsiveOverflowMenu.svelte';
	import type { RowActionItem } from '$lib/components/common/action-buttons';

	interface Props {
		/** e.g. "Payment 2" — used for the menu's accessible name. */
		rowLabel: string;
		canMerge: boolean;
		canSplit: boolean;
		canRemove: boolean;
		onMerge: () => void;
		onSplit: () => void;
		onRemove: () => void;
		disabled?: boolean;
	}

	let {
		rowLabel,
		canMerge,
		canSplit,
		canRemove,
		onMerge,
		onSplit,
		onRemove,
		disabled = false
	}: Props = $props();

	const items = $derived<RowActionItem[]>([
		{ label: 'Merge with previous', lucideIcon: Combine, onClick: onMerge, disabled: !canMerge },
		{ label: 'Split receipts', lucideIcon: Split, onClick: onSplit, disabled: !canSplit },
		{
			label: 'Remove',
			lucideIcon: Trash2,
			onClick: onRemove,
			destructive: true,
			separatorBefore: canMerge || canSplit,
			disabled: !canRemove
		}
	]);
</script>

<ResponsiveOverflowMenu {items} ariaLabel="{rowLabel} actions" sheetTitle={rowLabel}>
	{#snippet trigger({ props })}
		<Button
			{...props}
			type="button"
			variant="ghost"
			size="sm"
			class="h-8 w-8 p-0"
			aria-label="{rowLabel} actions"
			title="Actions"
			{disabled}
		>
			<MoreVertical class="h-4 w-4" />
		</Button>
	{/snippet}
</ResponsiveOverflowMenu>
