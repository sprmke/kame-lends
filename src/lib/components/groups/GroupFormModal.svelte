<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import GroupForm from '$lib/components/groups/GroupForm.svelte';
	import type { LoanGroup } from '$lib/types';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSuccess: (group: LoanGroup) => void | Promise<void>;
		existingGroup?: LoanGroup | null;
	}

	let { open, onOpenChange, onSuccess, existingGroup = null }: Props = $props();

	let isSubmitting = $state(false);

	const formId = $derived(
		existingGroup ? `group-edit-form-${existingGroup.id}` : 'group-create-form'
	);
	const isEdit = $derived(Boolean(existingGroup));
	const submitLabel = $derived(
		isSubmitting ? (isEdit ? 'Updating...' : 'Creating...') : isEdit ? 'Update' : 'Create Group'
	);

	async function handleSuccess(group: LoanGroup) {
		onOpenChange(false);
		await onSuccess(group);
	}
</script>

<ResponsiveModal {open} {onOpenChange} showCloseButton={false} contentClass="sm:max-w-lg">
	{#snippet header()}
		<FormHeader
			title={isEdit ? (existingGroup?.name ?? 'Group') : 'New Group'}
			description={isEdit ? 'Update group details' : 'Create a group to organize loans'}
			{formId}
			onCancel={() => onOpenChange(false)}
			{isSubmitting}
			isEditMode={isEdit}
			{submitLabel}
			variant="embedded"
		/>
	{/snippet}

	{#if open}
		{#key existingGroup?.id ?? 'new'}
			<GroupForm
				existingGroup={existingGroup ?? undefined}
				showFormHeader={false}
				{formId}
				bind:isSubmitting
				onSuccess={handleSuccess}
				onCancel={() => onOpenChange(false)}
			/>
		{/key}
	{/if}
</ResponsiveModal>
