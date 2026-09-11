<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Dialog from '$lib/components/ui/dialog';
	import PriceVisibilityToggle from './PriceVisibilityToggle.svelte';
	import { formatText } from '$lib/format';
	import { createIsMobileShell } from '$lib/composables/use-media-query.svelte';
	import RegisterMobileHeroActions from '$lib/components/layout/RegisterMobileHeroActions.svelte';
	import PageBackHeader from '$lib/components/common/PageBackHeader.svelte';
	import { createLoanActionItems } from '$lib/components/common/action-buttons';
	import ActionMenuList from '$lib/components/common/ActionMenuList.svelte';
	import { ArrowLeft, AlertCircle, CheckCircle, MoreHorizontal } from 'lucide-svelte';

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
		onContractDetails?: () => void;
		showPriceToggle?: boolean;
		onAddPayment?: () => void;
		onAddReceivedPayment?: () => void;
		signContractHref?: string;
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
		onContractDetails,
		showPriceToggle = true,
		onAddPayment,
		onAddReceivedPayment,
		signContractHref
	}: Props = $props();

	let showDeleteConfirm = $state(false);
	let showCompleteConfirm = $state(false);
	let isDeleting = $state(false);
	let isCompleting = $state(false);

	const isMobileShell = createIsMobileShell(false);

	$effect(() => isMobileShell.init());

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
			onComplete: onComplete ? () => (showCompleteConfirm = true) : undefined,
			showViewLoan,
			onViewLoan,
			canDelete,
			onDelete: canDelete ? () => (showDeleteConfirm = true) : undefined
		})
	);
</script>

{#snippet heroActions()}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="outline"
					size="sm"
					class="touch-target h-10 shrink-0 px-2 md:h-8 md:px-3"
					adaptToMobileHero
					title="Actions"
					aria-label="Actions"
				>
					<MoreHorizontal class="h-4 w-4" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<ActionMenuList items={actionItems} />
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/snippet}

{#if actionItems.length > 0}
	<RegisterMobileHeroActions snippet={heroActions} active={isMobileShell.matches} />
{/if}

<div class="lg:hidden">
	<PageBackHeader {title} {description} {backLabel} {onBack}>
		{#snippet actions()}
			{#if signContractHref}
				<Button href={signContractHref} size="sm" class="w-full">
					Sign contract
				</Button>
			{/if}
		{/snippet}
	</PageBackHeader>
</div>

<div class="hidden flex-col gap-4 lg:flex">
	<Button variant="ghost" size="sm" onclick={onBack} class="touch-target -ml-2 w-fit">
		<ArrowLeft class="mr-2 h-4 w-4" />
		{backLabel}
	</Button>

	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="min-w-0 space-y-1">
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

		{#if (actionItems.length > 0 && !isMobileShell.matches) || signContractHref}
			<div class="flex w-full items-center justify-end gap-1.5 lg:w-auto">
				{#if signContractHref}
					<Button href={signContractHref} variant="outline" size="sm">Sign contract</Button>
				{/if}
				{#if actionItems.length > 0 && !isMobileShell.matches}
					{@render heroActions()}
				{/if}
			</div>
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
				<CheckCircle class="h-5 w-5 text-chart-2" />
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
				class="bg-chart-2 text-white hover:bg-chart-2/90"
			>
				{isCompleting ? 'Completing...' : 'Yes, Complete'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
