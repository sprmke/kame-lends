<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import LoanForm from '$lib/components/loans/LoanForm.svelte';
	import type { Borrower, Investor } from '$lib/types';
	import type { DuplicateLoanData } from '$lib/loan-duplicate';
	import { Loader2 } from 'lucide-svelte';

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

	async function handleSuccess() {
		onOpenChange(false);
		await onSuccess?.();
	}

	const title = $derived(duplicateData ? 'Duplicate Loan' : 'Create New Loan');
</script>

<ResponsiveModal
	{open}
	{onOpenChange}
	{title}
	srOnlyHeader={true}
	contentClass="dashboard-dialog-wide sm:max-w-4xl"
>
	{#if loadingFormData}
		<div class="flex h-[60vh] flex-col items-center justify-center gap-4">
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
		</div>
	{:else}
		{#key duplicateData ? `dup-${duplicateData.name}` : 'new'}
			<LoanForm
				{investors}
				{borrowers}
				{preselectedInvestorId}
				{duplicateData}
				onSuccess={handleSuccess}
				onCancel={() => onOpenChange(false)}
			/>
		{/key}
	{/if}
</ResponsiveModal>
