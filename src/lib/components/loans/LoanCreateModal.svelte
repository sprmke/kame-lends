<script lang="ts">
	import type { Component } from 'svelte';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import type { Borrower, Investor } from '$lib/types';
	import type { DuplicateLoanData } from '$lib/loan-duplicate';
	import FormPageSkeleton from '$lib/components/common/FormPageSkeleton.svelte';
	import { createOverlayContentReady } from '$lib/composables/use-overlay-content-ready.svelte';

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
	let LoanFormComponent = $state<Component | null>(null);
	let loadingLoanFormModule = $state(false);
	const overlayContent = createOverlayContentReady();

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
		await onSuccess?.();
		onOpenChange(false);
	}

	$effect(() => {
		overlayContent.armWhenOpen(open);
	});

	$effect(() => {
		if (!open || loadingFormData || !overlayContent.ready) {
			if (!open) {
				LoanFormComponent = null;
				loadingLoanFormModule = false;
			}
			return;
		}

		if (LoanFormComponent) return;

		loadingLoanFormModule = true;
		void import('$lib/components/loans/LoanForm.svelte').then((mod) => {
			LoanFormComponent = mod.default;
			loadingLoanFormModule = false;
		});
	});

	const showFormSkeleton = $derived(
		loadingFormData || !overlayContent.ready || loadingLoanFormModule || !LoanFormComponent
	);
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

	{#if showFormSkeleton}
		<FormPageSkeleton />
	{:else}
		{#key duplicateData ? `dup-${duplicateData.name}` : 'new'}
			<LoanFormComponent
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
