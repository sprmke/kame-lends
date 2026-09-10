<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import DetailHeader from '$lib/components/common/DetailHeader.svelte';
	import LoanDetailContent from './LoanDetailContent.svelte';
	import LoanContractDetailsModal from './LoanContractDetailsModal.svelte';
	import LoanForm from './LoanForm.svelte';
	import LoanQuickPaymentDialog, {
		type LoanQuickPaymentKind
	} from './LoanQuickPaymentDialog.svelte';
	import FormPageSkeleton from '$lib/components/common/FormPageSkeleton.svelte';
	import EditFormSheet from '$lib/components/common/EditFormSheet.svelte';
	import LoanCreateModal from '$lib/components/loans/LoanCreateModal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { createIsMobileOverlay } from '$lib/composables/use-media-query.svelte';
	import { createDuplicateDataFromLoan } from '$lib/loan-duplicate';
	import { encodeJsonForUrl } from '$lib/base64-url';
	import { toast } from '$lib/toast';
	import { formatText } from '$lib/format';
	import type { Borrower, Investor, LoanWithInvestors, PaymentMethod } from '$lib/types';
	import type { LoanAccessContext } from '$lib/loan-access';

	interface Props {
		loan: LoanWithInvestors;
		investors: Investor[];
		borrowers: Borrower[];
		loadingFormData: boolean;
		access: LoanAccessContext;
		paymentMethods?: PaymentMethod[];
	}

	let { loan, investors, borrowers, loadingFormData, access, paymentMethods = [] }: Props =
		$props();

	let isEditing = $state(
		page.url.searchParams.get('edit') === '1' && access.canAdminEdit
	);
	let showContractDetailsModal = $state(false);
	let quickPaymentKind = $state<LoanQuickPaymentKind | null>(null);
	let showDuplicateModal = $state(false);
	let editSubmitting = $state(false);
	const mobile = createIsMobileOverlay(
		typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
	);

	$effect(() => mobile.init());

	const editFormId = $derived(`loan-detail-edit-${loan.id}`);

	const highlightSigning = $derived(page.url.searchParams.get('signing') === '1');

	$effect(() => {
		if (highlightSigning && access.canAdminEdit) {
			showContractDetailsModal = true;
		}
	});
	const isOverdue = $derived(loan.status === 'Overdue');
	const isPartiallyFunded = $derived(loan.status === 'Partially Funded');

	function handlePayBalance() {
		document
			.getElementById('investors-section')
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function handleDuplicate() {
		if (mobile.matches) {
			showDuplicateModal = true;
			return;
		}
		const duplicateData = createDuplicateDataFromLoan(loan);
		const encodedData = encodeJsonForUrl(duplicateData);
		goto(`/loans/new?duplicate=${encodeURIComponent(encodedData)}`);
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

{#if isEditing && !mobile.matches}
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
			description={`${formatText(loan.type)} · ${formatText(loan.status)}`}
			backLabel="Back"
			onBack={() => goto('/loans')}
			onEdit={() => (isEditing = true)}
			onDelete={handleDelete}
			canEdit={access.canAdminEdit}
			canDelete={access.canAdminEdit}
			deleteTitle="Delete Loan"
			deleteDescription="Delete this loan and its investor allocations?"
			showPayBalance={access.canAdminEdit && isPartiallyFunded}
			onPayBalance={handlePayBalance}
			showComplete={access.canAdminEdit && isOverdue}
			onComplete={handleComplete}
			showDuplicate={access.canAdminEdit}
			onDuplicate={handleDuplicate}
			onContractDetails={() => (showContractDetailsModal = true)}
			onAddPayment={
				access.canAdminEdit ? () => (quickPaymentKind = 'payment') : undefined
			}
			onAddReceivedPayment={
				access.canAdminEdit ? () => (quickPaymentKind = 'received') : undefined
			}
		/>

		{#if access.signingPartyRoles.length > 0 && !access.canAdminEdit}
			<div class="flex justify-end">
				<Button href={`/loans/${loan.id}/sign`} variant="outline" size="sm">Sign contract</Button>
			</div>
		{/if}

		<LoanDetailContent
			{loan}
			showHeader={false}
			onRefresh={handleRefresh}
			loanId={loan.id}
			readOnly={!access.canAdminEdit}
			editableInvestorIds={access.editableInvestorIds}
			{paymentMethods}
		/>

		{#if access.canAdminEdit}
			<LoanQuickPaymentDialog
				{loan}
				kind={quickPaymentKind}
				open={quickPaymentKind !== null}
				onOpenChange={(open) => {
					if (!open) quickPaymentKind = null;
				}}
				onSuccess={handleRefresh}
				allowedInvestorIds={access.canAdminEdit ? null : access.editableInvestorIds}
			/>
		{/if}
	</div>
{/if}

{#if isEditing && mobile.matches}
	<EditFormSheet
		open={true}
		onOpenChange={(open) => {
			if (!open) isEditing = false;
		}}
		title={formatText(loan.loanName)}
		description="Update loan details and investor allocations"
		formId={editFormId}
		isSubmitting={editSubmitting}
		isEditMode={true}
		submitLabel={editSubmitting ? 'Updating...' : 'Update Loan'}
	>
		{#if loadingFormData}
			<FormPageSkeleton />
		{:else}
			{#key loan.id}
				<LoanForm
					{investors}
					{borrowers}
					existingLoan={loan}
					formId={editFormId}
					showFormHeader={false}
					bind:isSubmitting={editSubmitting}
					onSuccess={handleEditSuccess}
					onCancel={() => (isEditing = false)}
				/>
			{/key}
		{/if}
	</EditFormSheet>
{/if}

<LoanCreateModal
	open={showDuplicateModal}
	onOpenChange={(open) => (showDuplicateModal = open)}
	{investors}
	{borrowers}
	duplicateData={showDuplicateModal ? createDuplicateDataFromLoan(loan) : null}
	onSuccess={handleRefresh}
/>

<LoanContractDetailsModal
	{loan}
	open={showContractDetailsModal}
	onOpenChange={(open) => (showContractDetailsModal = open)}
	canEdit={access.canAdminEdit}
	{borrowers}
	{investors}
	onSaved={handleRefresh}
/>
