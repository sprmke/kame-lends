<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import DetailHeader from '$lib/components/common/DetailHeader.svelte';
	import LoanDetailContent from './LoanDetailContent.svelte';
	import LoanSigningSection from './LoanSigningSection.svelte';
	import LoanForm from './LoanForm.svelte';
	import LoanQuickPaymentDialog, {
		type LoanQuickPaymentKind
	} from './LoanQuickPaymentDialog.svelte';
	import FormPageSkeleton from '$lib/components/common/FormPageSkeleton.svelte';
	import { Button } from '$lib/components/ui/button';
	import { createDuplicateDataFromLoan } from '$lib/loan-duplicate';
	import { downloadLoanContract } from '$lib/download-loan-contract';
	import { encodeJsonForUrl } from '$lib/base64-url';
	import { toast } from '$lib/toast';
	import type { Borrower, Investor, LoanWithInvestors } from '$lib/types';

	interface Props {
		loan: LoanWithInvestors;
		investors: Investor[];
		borrowers: Borrower[];
		loadingFormData: boolean;
	}

	let { loan, investors, borrowers, loadingFormData }: Props = $props();

	let isEditing = $state(page.url.searchParams.get('edit') === '1');
	let isDownloadingContract = $state(false);
	let quickPaymentKind = $state<LoanQuickPaymentKind | null>(null);

	const highlightSigning = $derived(page.url.searchParams.get('signing') === '1');
	const isOverdue = $derived(loan.status === 'Overdue');
	const isPartiallyFunded = $derived(loan.status === 'Partially Funded');

	function handlePayBalance() {
		document
			.getElementById('investors-section')
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function handleDuplicate() {
		const duplicateData = createDuplicateDataFromLoan(loan);
		const encodedData = encodeJsonForUrl(duplicateData);
		goto(`/loans/new?duplicate=${encodeURIComponent(encodedData)}`);
	}

	async function handleDownloadContract() {
		isDownloadingContract = true;
		try {
			await downloadLoanContract(loan);
		} finally {
			isDownloadingContract = false;
		}
	}

	async function handleDelete() {
		const response = await fetch(`/api/loans/${loan.id}`, { method: 'DELETE' });
		if (!response.ok) throw new Error('Failed to delete loan');
		toast.success('Loan deleted');
		await goto('/loans');
	}

	async function handleComplete() {
		const response = await fetch(`/api/loans/${loan.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				loanData: {
					borrowerId: loan.borrowerId,
					loanName: loan.loanName,
					type: loan.type,
					status: 'Completed',
					dueDate: loan.dueDate,
					freeLotSqm: loan.freeLotSqm,
					notes: loan.notes
				},
				investorData: loan.loanInvestors.map((li) => ({
					investorId: li.investorId,
					amount: li.amount,
					interestRate: li.interestRate,
					sentDate: li.sentDate
				}))
			})
		});
		if (!response.ok) throw new Error('Failed to complete loan');
		toast.success('Loan marked completed');
		await invalidateAll();
	}

	async function handleRefresh() {
		await invalidateAll();
	}

	async function handleEditSuccess() {
		isEditing = false;
		await invalidateAll();
	}
</script>

{#if isEditing}
	{#if loadingFormData}
		<FormPageSkeleton />
	{:else}
		{#key loan.id}
			<LoanForm
				{investors}
				{borrowers}
				existingLoan={loan}
				onSuccess={handleEditSuccess}
				onCancel={() => (isEditing = false)}
			/>
		{/key}
	{/if}
{:else}
	<div class="dashboard-stack">
		<DetailHeader
			title={loan.loanName}
			description="View and manage loan details"
			backLabel="Back to Loans"
			onBack={() => goto('/loans')}
			onEdit={() => (isEditing = true)}
			onDelete={handleDelete}
			deleteTitle="Delete Loan"
			deleteDescription="Are you sure you want to delete this loan? This action cannot be undone and will remove all associated investor allocations."
			showPayBalance={isPartiallyFunded}
			onPayBalance={handlePayBalance}
			showComplete={isOverdue}
			onComplete={handleComplete}
			showDuplicate={true}
			onDuplicate={handleDuplicate}
			showDownloadContract={true}
			onDownloadContract={handleDownloadContract}
			{isDownloadingContract}
			onAddPayment={() => (quickPaymentKind = 'payment')}
			onAddReceivedPayment={() => (quickPaymentKind = 'received')}
		/>

		<LoanSigningSection loanId={loan.id} highlight={highlightSigning} />

		<LoanDetailContent {loan} showHeader={false} onRefresh={handleRefresh} loanId={loan.id} />

		<LoanQuickPaymentDialog
			{loan}
			kind={quickPaymentKind}
			open={quickPaymentKind !== null}
			onOpenChange={(open) => {
				if (!open) quickPaymentKind = null;
			}}
			onSuccess={handleRefresh}
		/>
	</div>
{/if}
