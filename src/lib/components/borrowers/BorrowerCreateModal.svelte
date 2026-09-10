<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import BorrowerForm from '$lib/components/borrowers/BorrowerForm.svelte';
	import type { Borrower } from '$lib/types';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSuccess?: (borrower: Borrower) => void | Promise<void>;
	}

	let { open, onOpenChange, onSuccess }: Props = $props();

	let isSubmitting = $state(false);

	const formId = 'borrower-create-form';
	const submitLabel = $derived(isSubmitting ? 'Creating...' : 'Create');

	async function handleSuccess(borrower: Borrower) {
		onOpenChange(false);
		await onSuccess?.(borrower);
	}
</script>

<ResponsiveModal
	{open}
	{onOpenChange}
	showCloseButton={false}
	contentClass="sm:max-w-lg"
>
	{#snippet header()}
		<FormHeader
			title="Add Borrower"
			{formId}
			onCancel={() => onOpenChange(false)}
			{isSubmitting}
			isEditMode={false}
			{submitLabel}
			variant="embedded"
		/>
	{/snippet}

	{#if open}
		{#key open}
			<BorrowerForm
				embedded
				showFormHeader={false}
				{formId}
				bind:isSubmitting
				onSuccess={handleSuccess}
				onCancel={() => onOpenChange(false)}
			/>
		{/key}
	{/if}
</ResponsiveModal>
