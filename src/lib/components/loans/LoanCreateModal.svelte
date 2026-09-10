<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import LoanForm from '$lib/components/loans/LoanForm.svelte';
	import type { Borrower, Investor } from '$lib/types';
	import type { DuplicateLoanData } from '$lib/loan-duplicate';
	import FormPageSkeleton from '$lib/components/common/FormPageSkeleton.svelte';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSuccess?: () => void | Promise<void>;
		preselectedInvestorId?: number;
		duplicateData?: DuplicateLoanData | null;
		investors?: Investor[];
		borrowers?: Borrower[];
		loadingFormData?: boolean;
	}

	let {
		open,
		onOpenChange,
		onSuccess,
		preselectedInvestorId,
		duplicateData = null,
		investors = [],
		borrowers = [],
		loadingFormData = false
	}: Props = $props();

	let isSubmitting = $state(false);

	const formId = 'loan-create-form';

	const formTitle = $derived(duplicateData ? 'Duplicate Loan' : 'Create Loan');
	const formDescription = 'Add a new loan with investor allocations';
	const submitLabel = $derived(
		isSubmitting
			? 'Creating...'
			: duplicateData
				? 'Duplicate Loan'
				: 'Create Loan'
	);

	async function handleSuccess() {
		onOpenChange(false);
		await onSuccess?.();
	}
</script>

<ResponsiveModal
	{open}
	{onOpenChange}
	showCloseButton={false}
	contentClass="dashboard-dialog-wide !max-w-4xl"
>
	{#snippet header()}
		<FormHeader
			title={formTitle}
			description={formDescription}
			{formId}
			onCancel={() => onOpenChange(false)}
			{isSubmitting}
			isEditMode={false}
			{submitLabel}
			variant="embedded"
		/>
	{/snippet}

	{#if loadingFormData}
		<FormPageSkeleton />
	{:else}
		{#key duplicateData ? `dup-${duplicateData.name}` : 'new'}
			<LoanForm
				{investors}
				{borrowers}
				{preselectedInvestorId}
				{duplicateData}
				{formId}
				showFormHeader={false}
				bind:isSubmitting
				onSuccess={handleSuccess}
				onCancel={() => onOpenChange(false)}
			/>
		{/key}
	{/if}
</ResponsiveModal>
