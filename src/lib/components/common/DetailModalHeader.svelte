<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import {
		ArrowDownToLine,
		ArrowUpFromLine,
		CheckCircle,
		Copy,
		Edit,
		Eye,
		FileText,
		MoreVertical,
		Trash2,
		Wallet,
		X
	} from 'lucide-svelte';

	type ActionIcon =
		| 'fund'
		| 'received'
		| 'pay'
		| 'edit'
		| 'duplicate'
		| 'contract'
		| 'complete'
		| 'view'
		| 'delete';

	interface ActionItem {
		label: string;
		onclick: () => void;
		icon: ActionIcon;
		destructive?: boolean;
		disabled?: boolean;
		separatorBefore?: boolean;
	}

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
		onDownloadContract?: () => void;
		showDownloadContract?: boolean;
		isDownloadingContract?: boolean;
		onAddPayment?: () => void;
		onAddReceivedPayment?: () => void;
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
		onDownloadContract,
		showDownloadContract = false,
		isDownloadingContract = false,
		onAddPayment,
		onAddReceivedPayment
	}: Props = $props();

	const btnClass = 'h-8 shrink-0 px-2 md:px-3';

	const actionItems = $derived.by((): ActionItem[] => {
		const items: ActionItem[] = [];

		if (onAddPayment) {
			items.push({ label: 'Fund Transfer', onclick: onAddPayment, icon: 'fund' });
		}
		if (onAddReceivedPayment) {
			items.push({
				label: 'Add Received Payment',
				onclick: onAddReceivedPayment,
				icon: 'received'
			});
		}
		if (showPayBalance && onPayBalance) {
			items.push({ label: 'Pay', onclick: onPayBalance, icon: 'pay' });
		}
		if (canEdit) {
			items.push({
				label: 'Edit',
				onclick: onEdit,
				icon: 'edit',
				separatorBefore: Boolean(
					onAddPayment || onAddReceivedPayment || (showPayBalance && onPayBalance)
				)
			});
		}
		if (showDuplicate && onDuplicate) {
			items.push({
				label: 'Duplicate',
				onclick: onDuplicate,
				icon: 'duplicate',
				separatorBefore: !canEdit && Boolean(onAddPayment || onAddReceivedPayment)
			});
		}
		if (showDownloadContract && onDownloadContract) {
			items.push({
				label: isDownloadingContract ? 'Generating Contract...' : 'Download Contract',
				onclick: () => {
					if (!isDownloadingContract) onDownloadContract();
				},
				icon: 'contract',
				disabled: isDownloadingContract
			});
		}
		if (showComplete && onComplete) {
			items.push({ label: 'Complete', onclick: onComplete, icon: 'complete' });
		}
		if (showViewLoan && onViewLoan) {
			items.push({ label: 'View Loan', onclick: onViewLoan, icon: 'view' });
		}
		if (canDelete) {
			items.push({
				label: 'Delete',
				onclick: onDelete,
				icon: 'delete',
				destructive: true,
				separatorBefore: true
			});
		}

		return items;
	});
</script>

<div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
	{#if actionItems.length > 0}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="outline" size="sm" class={btnClass} title="Actions">
						<MoreVertical class="h-4 w-4" />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-52">
				{#each actionItems as item, index (item.label)}
					{#if item.separatorBefore && index > 0}
						<DropdownMenu.Separator />
					{/if}
					<DropdownMenu.Item
						onclick={item.onclick}
						disabled={item.disabled}
						class={item.destructive ? 'text-destructive focus:text-destructive' : undefined}
					>
						{#if item.icon === 'fund'}
							<ArrowUpFromLine class="mr-2 h-4 w-4" />
						{:else if item.icon === 'received'}
							<ArrowDownToLine class="mr-2 h-4 w-4" />
						{:else if item.icon === 'pay'}
							<Wallet class="mr-2 h-4 w-4" />
						{:else if item.icon === 'edit'}
							<Edit class="mr-2 h-4 w-4" />
						{:else if item.icon === 'duplicate'}
							<Copy class="mr-2 h-4 w-4" />
						{:else if item.icon === 'contract'}
							<FileText class="mr-2 h-4 w-4" />
						{:else if item.icon === 'complete'}
							<CheckCircle class="mr-2 h-4 w-4" />
						{:else if item.icon === 'view'}
							<Eye class="mr-2 h-4 w-4" />
						{:else if item.icon === 'delete'}
							<Trash2 class="mr-2 h-4 w-4" />
						{/if}
						{item.label}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{/if}
	{#if onClose}
		<Button variant="outline" size="sm" onclick={onClose} class={btnClass} title="Close">
			<X class="h-4 w-4" />
		</Button>
	{/if}
</div>
