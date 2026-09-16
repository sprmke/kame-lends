<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { createLoanActionItems } from '$lib/components/common/action-buttons';
	import ResponsiveOverflowMenu from '$lib/components/common/ResponsiveOverflowMenu.svelte';
	import { MoreVertical, X } from 'lucide-svelte';

	interface Props {
		onEdit: () => void;
		onDelete: () => void;
		onClose?: () => void;
		canEdit?: boolean;
		canDelete?: boolean;
		onComplete?: () => void;
		showComplete?: boolean;
		onPayBalance?: () => void;
		showPayBalance?: boolean;
		onViewLoan?: () => void;
		showViewLoan?: boolean;
		onDuplicate?: () => void;
		showDuplicate?: boolean;
		onManageGroups?: () => void;
		showManageGroups?: boolean;
		onContractDetails?: () => void;
		onAddPayment?: () => void;
		onAddReceivedPayment?: () => void;
		class?: string;
	}

	let {
		onEdit,
		onDelete,
		onClose,
		canEdit = true,
		canDelete = true,
		onComplete,
		showComplete = false,
		onPayBalance,
		showPayBalance = false,
		onViewLoan,
		showViewLoan = false,
		onDuplicate,
		showDuplicate = false,
		onManageGroups,
		showManageGroups = false,
		onContractDetails,
		onAddPayment,
		onAddReceivedPayment,
		class: className = ''
	}: Props = $props();

	const btnClass = 'h-8 shrink-0 px-2 md:px-3';

	const actionItems = $derived(
		createLoanActionItems({
			canEdit,
			onEdit,
			showDuplicate,
			onDuplicate,
			showManageGroups,
			onManageGroups,
			onAddPayment,
			onAddReceivedPayment,
			showPayBalance,
			onPayBalance,
			onContractDetails,
			showComplete,
			onComplete,
			showViewLoan,
			onViewLoan,
			canDelete,
			onDelete
		})
	);
</script>

<div class={cn('flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2', className)}>
	{#if actionItems.length > 0}
		<ResponsiveOverflowMenu items={actionItems} ariaLabel="Actions" sheetTitle="Actions">
			{#snippet trigger({ props })}
				<Button
					{...props}
					variant="outline"
					size="sm"
					class={btnClass}
					title="Actions"
					aria-label="Actions"
				>
					<MoreVertical class="h-4 w-4" />
				</Button>
			{/snippet}
		</ResponsiveOverflowMenu>
	{/if}
	{#if onClose}
		<Button variant="outline" size="sm" onclick={onClose} class={btnClass} title="Close">
			<X class="h-4 w-4" />
		</Button>
	{/if}
</div>
