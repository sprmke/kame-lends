<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
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
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content class="dashboard-dialog-wide max-h-[90vh] overflow-y-auto">
		<Dialog.Header class="sr-only">
			<Dialog.Title>{duplicateData ? 'Duplicate Loan' : 'Create New Loan'}</Dialog.Title>
		</Dialog.Header>
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
	</Dialog.Content>
</Dialog.Root>
