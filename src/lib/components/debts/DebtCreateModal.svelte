<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import DebtForm from '$lib/components/debts/DebtForm.svelte';
	import FormPageSkeleton from '$lib/components/common/FormPageSkeleton.svelte';
	import type { Investor } from '$lib/types';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSuccess?: () => void;
		preselectedInvestorId?: number;
	}

	let { open, onOpenChange, onSuccess, preselectedInvestorId }: Props = $props();

	let investors = $state<Investor[]>([]);
	let isLoading = $state(false);
	let isSubmitting = $state(false);

	const formId = 'debt-create-form';

	const submitLabel = $derived(isSubmitting ? 'Creating...' : 'Create Bank Loan');

	$effect(() => {
		if (!open) return;
		let active = true;
		isLoading = true;
		fetch('/api/investors?simple=true')
			.then((response) => response.json())
			.then((data) => {
				if (active && Array.isArray(data)) investors = data;
			})
			.catch((error) => console.error('Error fetching investors:', error))
			.finally(() => {
				if (active) isLoading = false;
			});
		return () => {
			active = false;
		};
	});

	function handleSuccess() {
		onOpenChange(false);
		onSuccess?.();
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
			title="Create Bank Loan"
			description="Record a bank loan and preview expected interest costs"
			{formId}
			onCancel={() => onOpenChange(false)}
			{isSubmitting}
			isEditMode={false}
			{submitLabel}
			variant="embedded"
		/>
	{/snippet}

	{#if isLoading}
		<FormPageSkeleton />
	{:else}
		<DebtForm
			{investors}
			{preselectedInvestorId}
			{formId}
			showFormHeader={false}
			bind:isSubmitting
			cancelHref="#"
			onSuccess={handleSuccess}
			onCancel={() => onOpenChange(false)}
		/>
	{/if}
</ResponsiveModal>
