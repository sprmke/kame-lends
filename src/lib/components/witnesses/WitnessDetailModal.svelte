<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import DetailModalHeader from '$lib/components/common/DetailModalHeader.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import WitnessDetailContent from '$lib/components/witnesses/WitnessDetailContent.svelte';
	import WitnessForm from '$lib/components/witnesses/WitnessForm.svelte';
	import DetailModalHeaderSkeleton from '$lib/components/common/page-skeletons/DetailModalHeaderSkeleton.svelte';
	import WitnessDetailSkeleton from '$lib/components/common/page-skeletons/WitnessDetailSkeleton.svelte';
	import { countWitnessedLoans } from '$lib/witness-loans';
	import { formatText } from '$lib/format';
	import { toast } from '$lib/toast';
	import type { WitnessWithLoans } from '$lib/types';

	interface Props {
		witness: WitnessWithLoans | null;
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onUpdate?: () => void | Promise<void>;
		startInEditMode?: boolean;
	}

	let {
		witness: initialWitness,
		open,
		onOpenChange,
		onUpdate,
		startInEditMode = false
	}: Props = $props();

	let witness = $state<WitnessWithLoans | null>(initialWitness);
	let isEditing = $state(false);
	let isLoading = $state(false);
	let isSubmitting = $state(false);
	let showDeleteDialog = $state(false);
	let isDeleting = $state(false);
	let fetchKey = $state(0);

	$effect.pre(() => {
		if (initialWitness) witness = initialWitness;
	});

	$effect(() => {
		if (!open || !initialWitness?.id) {
			if (!open) isLoading = false;
			return;
		}
		isEditing = startInEditMode;
		isLoading = true;
		void fetchWitness(initialWitness.id);
	});

	$effect(() => {
		if (!open) isEditing = false;
	});

	const editFormId = $derived(witness ? `witness-edit-form-${witness.id}` : undefined);
	const editSubmitLabel = $derived(isSubmitting ? 'Updating...' : 'Update');
	const canDelete = $derived((witness?.signingInvitations?.length ?? 0) === 0);

	async function fetchWitness(id: number) {
		try {
			const response = await fetch(`/api/witnesses/${id}`);
			if (!response.ok) throw new Error('Failed to fetch witness');
			witness = (await response.json()) as WitnessWithLoans;
			fetchKey += 1;
		} catch (error) {
			console.error(error);
			toast.error('Failed to load witness');
		} finally {
			isLoading = false;
		}
	}

	async function handleEditSuccess() {
		isEditing = false;
		if (witness?.id) await fetchWitness(witness.id);
		await onUpdate?.();
	}

	async function handleDelete() {
		if (!witness?.id) return;
		isDeleting = true;
		try {
			const response = await fetch(`/api/witnesses/${witness.id}`, { method: 'DELETE' });
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to delete witness');
			}
			toast.success('Witness deleted');
			showDeleteDialog = false;
			onOpenChange(false);
			await onUpdate?.();
		} catch (error) {
			console.error(error);
			toast.error(error instanceof Error ? error.message : 'Failed to delete witness');
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
		{:else if witness}
			{#if isEditing}
				<FormHeader
					title={formatText(witness.name)}
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
						{formatText(witness.name)}
					</h2>
					<DetailModalHeader
						onEdit={() => (isEditing = true)}
						onDelete={() => (showDeleteDialog = true)}
						onClose={() => onOpenChange(false)}
						{canDelete}
					/>
				</div>
			{/if}
		{/if}
	{/snippet}

	{#if isLoading && !isEditing}
		<WitnessDetailSkeleton />
	{:else if witness}
		{#if isEditing}
			{#key `witness-form-edit-${witness.id}-${fetchKey}`}
				<WitnessForm
					existingWitness={witness}
					formId={editFormId}
					showFormHeader={false}
					bind:isSubmitting
					onSuccess={handleEditSuccess}
					onCancel={() => (isEditing = false)}
				/>
			{/key}
		{:else}
			<WitnessDetailContent {witness} showHeader={false} />
		{/if}
	{/if}
</ResponsiveModal>

{#if witness}
	<AlertDialog.Root open={showDeleteDialog} onOpenChange={(v) => (showDeleteDialog = v)}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Delete witness?</AlertDialog.Title>
				<AlertDialog.Description>
					{#if canDelete}
						This will permanently delete "{formatText(witness.name)}".
					{:else}
						Cannot delete this witness because they have {countWitnessedLoans(witness)} witnessed
						loan(s).
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
