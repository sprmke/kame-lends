<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Dialog from '$lib/components/ui/dialog';
	import PriceVisibilityToggle from './PriceVisibilityToggle.svelte';
	import { formatText } from '$lib/format';
	import {
		ArrowLeft,
		ArrowDownToLine,
		ArrowUpFromLine,
		Edit,
		Trash2,
		AlertCircle,
		CheckCircle,
		Wallet,
		ExternalLink,
		Copy,
		MoreVertical,
		FileText
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
		title: string;
		description?: string;
		backLabel: string;
		onBack: () => void;
		onEdit?: () => void;
		onDelete: () => Promise<void>;
		deleteTitle: string;
		deleteDescription: string;
		canEdit?: boolean;
		canDelete?: boolean;
		deleteWarning?: string;
		onComplete?: () => Promise<void>;
		showComplete?: boolean;
		completeTitle?: string;
		completeDescription?: string;
		onPayBalance?: () => void;
		showPayBalance?: boolean;
		onViewLoan?: () => void;
		showViewLoan?: boolean;
		onDuplicate?: () => void;
		showDuplicate?: boolean;
		onDownloadContract?: () => void;
		showDownloadContract?: boolean;
		isDownloadingContract?: boolean;
		showPriceToggle?: boolean;
		onAddPayment?: () => void;
		onAddReceivedPayment?: () => void;
	}

	let {
		title,
		description,
		backLabel,
		onBack,
		onEdit,
		onDelete,
		deleteTitle,
		deleteDescription,
		canEdit = true,
		canDelete = true,
		deleteWarning,
		onComplete,
		showComplete = false,
		completeTitle = 'Complete Loan',
		completeDescription = 'Are you sure you want to mark this loan as completed?',
		onPayBalance,
		showPayBalance = false,
		onViewLoan,
		showViewLoan = false,
		onDuplicate,
		showDuplicate = false,
		onDownloadContract,
		showDownloadContract = false,
		isDownloadingContract = false,
		showPriceToggle = true,
		onAddPayment,
		onAddReceivedPayment
	}: Props = $props();

	let showDeleteConfirm = $state(false);
	let showCompleteConfirm = $state(false);
	let isDeleting = $state(false);
	let isCompleting = $state(false);

	async function handleDelete() {
		isDeleting = true;
		try {
			await onDelete();
			showDeleteConfirm = false;
		} catch (error) {
			console.error('Error deleting:', error);
		} finally {
			isDeleting = false;
		}
	}

	async function handleComplete() {
		if (!onComplete) return;
		isCompleting = true;
		try {
			await onComplete();
			showCompleteConfirm = false;
		} catch (error) {
			console.error('Error completing:', error);
		} finally {
			isCompleting = false;
		}
	}

	const actionItems = $derived.by((): ActionItem[] => {
		const items: ActionItem[] = [];

		if (onAddPayment) {
			items.push({
				label: 'Fund Transfer',
				onclick: onAddPayment,
				icon: 'fund'
			});
		}
		if (onAddReceivedPayment) {
			items.push({
				label: 'Add Received Payment',
				onclick: onAddReceivedPayment,
				icon: 'received'
			});
		}
		if (showPayBalance && onPayBalance) {
			items.push({
				label: 'Pay',
				onclick: onPayBalance,
				icon: 'pay'
			});
		}
		if (onEdit && canEdit) {
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
				separatorBefore: !(onEdit && canEdit) && Boolean(onAddPayment || onAddReceivedPayment)
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
			items.push({
				label: 'Complete',
				onclick: () => (showCompleteConfirm = true),
				icon: 'complete'
			});
		}
		if (showViewLoan && onViewLoan) {
			items.push({
				label: 'View Loan',
				onclick: onViewLoan,
				icon: 'view'
			});
		}
		if (canDelete) {
			items.push({
				label: 'Delete',
				onclick: () => (showDeleteConfirm = true),
				icon: 'delete',
				destructive: true,
				separatorBefore: true
			});
		}

		return items;
	});
</script>

<div class="flex flex-col gap-3">
	<Button variant="ghost" size="sm" onclick={onBack} class="touch-target -ml-2 w-fit">
		<ArrowLeft class="mr-2 h-4 w-4" />
		{backLabel}
	</Button>

	<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div class="space-y-1">
			<div class="flex flex-wrap items-center gap-2.5">
				<h1 class="text-xl font-semibold tracking-tight">{formatText(title)}</h1>
				{#if showPriceToggle}
					<PriceVisibilityToggle />
				{/if}
			</div>
			{#if description}
				<p class="text-sm text-muted-foreground">{formatText(description)}</p>
			{/if}
		</div>

		{#if actionItems.length > 0}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="outline"
							size="sm"
							class="touch-target h-10 shrink-0 px-2 md:h-8 md:px-3"
							title="Actions"
						>
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
								<ExternalLink class="mr-2 h-4 w-4" />
							{:else if item.icon === 'delete'}
								<Trash2 class="mr-2 h-4 w-4" />
							{/if}
							{item.label}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}
	</div>
</div>

<Dialog.Root bind:open={showDeleteConfirm}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<AlertCircle class="h-5 w-5 text-destructive" />
				{formatText(deleteTitle)}
			</Dialog.Title>
			<Dialog.Description class="mt-2">
				{#if canDelete}
					{formatText(deleteDescription)}
				{:else}
					{formatText(deleteWarning)}
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showDeleteConfirm = false)} disabled={isDeleting}>
				{canDelete ? 'Cancel' : 'Close'}
			</Button>
			{#if canDelete}
				<Button variant="destructive" onclick={handleDelete} disabled={isDeleting}>
					{isDeleting ? 'Deleting...' : 'Yes, Delete'}
				</Button>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={showCompleteConfirm}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<CheckCircle class="h-5 w-5 text-emerald-600" />
				{formatText(completeTitle)}
			</Dialog.Title>
			<Dialog.Description>{formatText(completeDescription)}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button
				variant="outline"
				onclick={() => (showCompleteConfirm = false)}
				disabled={isCompleting}
			>
				Cancel
			</Button>
			<Button
				onclick={handleComplete}
				disabled={isCompleting}
				class="bg-green-600 hover:bg-green-700"
			>
				{isCompleting ? 'Completing...' : 'Yes, Complete'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
