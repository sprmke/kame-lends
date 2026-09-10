<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import WitnessForm from '$lib/components/witnesses/WitnessForm.svelte';
	import type { Witness } from '$lib/types';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSuccess?: (witness: Witness) => void | Promise<void>;
	}

	let { open, onOpenChange, onSuccess }: Props = $props();

	let isSubmitting = $state(false);

	const formId = 'witness-create-form';
	const submitLabel = $derived(isSubmitting ? 'Creating...' : 'Create');

	async function handleSuccess(witness: Witness) {
		onOpenChange(false);
		await onSuccess?.(witness);
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
			title="Add Witness"
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
			<WitnessForm
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
