<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import DetailModalHeader from '$lib/components/common/DetailModalHeader.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import BorrowerDetailContent from '$lib/components/borrowers/BorrowerDetailContent.svelte';
	import BorrowerForm from '$lib/components/borrowers/BorrowerForm.svelte';
	import DetailModalHeaderSkeleton from '$lib/components/common/page-skeletons/DetailModalHeaderSkeleton.svelte';
	import BorrowerDetailSkeleton from '$lib/components/common/page-skeletons/BorrowerDetailSkeleton.svelte';
	import { formatText } from '$lib/format';
	import { toast } from '$lib/toast';
	import type { BorrowerWithLoans } from '$lib/types';

	interface Props {
		borrower: BorrowerWithLoans | null;
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onUpdate?: () => void | Promise<void>;
		startInEditMode?: boolean;
	}

	let {
		borrower: initialBorrower,
		open,
		onOpenChange,
		onUpdate,
		startInEditMode = false
	}: Props = $props();

	let borrower = $state<BorrowerWithLoans | null>(initialBorrower);
	let isEditing = $state(false);
	let isLoading = $state(false);
	let isSubmitting = $state(false);
	let showDeleteDialog = $state(false);
	let isDeleting = $state(false);
	let fetchKey = $state(0);

	$effect.pre(() => {
		if (initialBorrower) borrower = initialBorrower;
	});

	$effect(() => {
		if (!open || !initialBorrower?.id) {
			if (!open) isLoading = false;
			return;
		}
		isEditing = startInEditMode;
		isLoading = true;
		void fetchBorrower(initialBorrower.id);
	});

	$effect(() => {
		if (!open) isEditing = false;
	});

	const editFormId = $derived(borrower ? `borrower-edit-form-${borrower.id}` : undefined);
	const editSubmitLabel = $derived(isSubmitting ? 'Updating...' : 'Update');
	const canDelete = $derived((borrower?.loans?.length ?? 0) === 0);

	async function fetchBorrower(id: number) {
		try {
			const response = await fetch(`/api/borrowers/${id}`);
			if (!response.ok) throw new Error('Failed to fetch borrower');
			borrower = (await response.json()) as BorrowerWithLoans;
			fetchKey += 1;
		} catch (error) {
			console.error(error);
			toast.error('Failed to load borrower');
		} finally {
			isLoading = false;
		}
	}

	async function handleEditSuccess() {
		isEditing = false;
		if (borrower?.id) await fetchBorrower(borrower.id);
		await onUpdate?.();
	}

	async function handleDelete() {
		if (!borrower?.id) return;
		isDeleting = true;
		try {
			const response = await fetch(`/api/borrowers/${borrower.id}`, { method: 'DELETE' });
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to delete borrower');
			}
			toast.success('Borrower deleted');
			showDeleteDialog = false;
			onOpenChange(false);
			await onUpdate?.();
		} catch (error) {
			console.error(error);
			toast.error(error instanceof Error ? error.message : 'Failed to delete borrower');
		} finally {
			isDeleting = false;
		}
	}
</script>

<ResponsiveModal
	{open}
	{onOpenChange}
	showCloseButton={false}
	contentClass="dashboard-dialog-wide !max-w-3xl"
>
	{#snippet header()}
		{#if isLoading && !isEditing}
			<DetailModalHeaderSkeleton />
		{:else if borrower}
			{#if isEditing}
				<FormHeader
					title={formatText(borrower.name)}
					formId={editFormId}
					onCancel={() => (isEditing = false)}
					{isSubmitting}
					isEditMode={true}
					submitLabel={editSubmitLabel}
					variant="embedded"
				/>
			{:else}
				<div class="flex items-start justify-between gap-3 md:gap-4">
					<h2
						class="min-w-0 flex-1 text-base font-medium tracking-tight line-clamp-2 md:line-clamp-none"
					>
						{formatText(borrower.name)}
					</h2>
					<DetailModalHeader
						onEdit={() => (isEditing = true)}
						onDelete={() => (showDeleteDialog = true)}
						onClose={() => onOpenChange(false)}
						canDelete={canDelete}
					/>
				</div>
			{/if}
		{/if}
	{/snippet}

	{#if isLoading && !isEditing}
		<BorrowerDetailSkeleton />
	{:else if borrower}
		{#if isEditing}
			{#key `borrower-form-edit-${borrower.id}-${fetchKey}`}
				<BorrowerForm
					existingBorrower={borrower}
					formId={editFormId}
					showFormHeader={false}
					bind:isSubmitting
					onSuccess={handleEditSuccess}
					onCancel={() => (isEditing = false)}
				/>
			{/key}
		{:else}
			<BorrowerDetailContent {borrower} showHeader={false} />
		{/if}
	{/if}
</ResponsiveModal>

{#if borrower}
	<AlertDialog.Root open={showDeleteDialog} onOpenChange={(v) => (showDeleteDialog = v)}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Delete borrower?</AlertDialog.Title>
				<AlertDialog.Description>
					{#if canDelete}
						This will permanently delete "{formatText(borrower.name)}".
					{:else}
						Cannot delete this borrower because they have {borrower.loans?.length ?? 0} loan(s).
					{/if}
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
				{#if canDelete}
					<AlertDialog.Action
						class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						disabled={isDeleting}
						onclick={handleDelete}
					>
						{isDeleting ? 'Deleting...' : 'Delete'}
					</AlertDialog.Action>
				{/if}
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
