<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { createLoanActionItems } from '$lib/components/common/action-buttons';
	import ActionMenuList from '$lib/components/common/ActionMenuList.svelte';
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
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
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
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<ActionMenuList items={actionItems} />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{/if}
	{#if onClose}
		<Button variant="outline" size="sm" onclick={onClose} class={btnClass} title="Close">
			<X class="h-4 w-4" />
		</Button>
	{/if}
</div>
