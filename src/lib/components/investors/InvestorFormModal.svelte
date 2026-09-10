<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import InvestorForm from '$lib/components/investors/InvestorForm.svelte';
	import PartyUserEditForm from '$lib/components/party/PartyUserEditForm.svelte';
	import type { Investor } from '$lib/types';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSuccess: (investor: Investor) => void | Promise<void>;
		existingInvestor?: Investor | null;
	}

	let { open, onOpenChange, onSuccess, existingInvestor = null }: Props = $props();

	let isSubmitting = $state(false);

	const formId = $derived(
		existingInvestor ? `investor-edit-form-${existingInvestor.id}` : 'investor-create-form'
	);
	const isEdit = $derived(Boolean(existingInvestor));
	const submitLabel = $derived(
		isSubmitting ? (isEdit ? 'Updating...' : 'Creating...') : isEdit ? 'Update' : 'Create Investor'
	);

	async function handleCreateSuccess(investor: Investor) {
		onOpenChange(false);
		await onSuccess(investor);
	}

	async function handleEditSuccess() {
		onOpenChange(false);
		if (existingInvestor) {
			await onSuccess(existingInvestor);
		}
	}
</script>

<ResponsiveModal
	{open}
	{onOpenChange}
	showCloseButton={false}
	contentClass={isEdit ? 'sm:max-w-2xl' : 'sm:max-w-lg'}
>
	{#snippet header()}
		<FormHeader
			title={isEdit ? (existingInvestor?.name ?? 'Investor') : 'Add Investor'}
			description={isEdit ? 'Update contact details' : 'Add a new investor to your portfolio'}
			{formId}
			onCancel={() => onOpenChange(false)}
			{isSubmitting}
			isEditMode={isEdit}
			{submitLabel}
			variant="embedded"
		/>
	{/snippet}

	{#if open}
		{#key existingInvestor?.id ?? 'new'}
			{#if isEdit && existingInvestor}
				<PartyUserEditForm
					entityType="investor"
					entityId={existingInvestor.id}
					displayName={existingInvestor.name}
					{formId}
					embedded
					showFormHeader={false}
					showNotes={false}
					bind:isSubmitting
					onSuccess={handleEditSuccess}
					onCancel={() => onOpenChange(false)}
				/>
			{:else}
				<InvestorForm
					showFormHeader={false}
					{formId}
					bind:isSubmitting
					onSuccess={handleCreateSuccess}
					onCancel={() => onOpenChange(false)}
				/>
			{/if}
		{/key}
	{/if}
</ResponsiveModal>
