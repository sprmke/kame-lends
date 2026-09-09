<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import DetailModalHeader from '$lib/components/common/DetailModalHeader.svelte';
	import LoanDetailContent from './LoanDetailContent.svelte';
	import LoanSigningSection from './LoanSigningSection.svelte';
	import LoanForm from './LoanForm.svelte';
	import FormPageSkeleton from '$lib/components/common/FormPageSkeleton.svelte';
	import LoanQuickPaymentDialog, {
		type LoanQuickPaymentKind
	} from './LoanQuickPaymentDialog.svelte';
	import { createDuplicateDataFromLoan } from '$lib/loan-duplicate';
	import { downloadLoanContract } from '$lib/download-loan-contract';
	import { formatText } from '$lib/format';
	import { toast } from '$lib/toast';
	import type { Borrower, Investor, LoanWithInvestors, PaymentMethod } from '$lib/types';
	import type { DuplicateLoanData } from '$lib/loan-duplicate';

	interface Props {
		loan: LoanWithInvestors | null;
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onUpdate?: () => void | Promise<void>;
		onDuplicate?: (duplicateData: DuplicateLoanData) => void | Promise<void>;
		startInEditMode?: boolean;
		readOnly?: boolean;
	}

	let {
		loan: initialLoan,
		open,
		onOpenChange,
		onUpdate,
		onDuplicate,
		startInEditMode = false,
		readOnly = false
	}: Props = $props();

	let loan = $state<LoanWithInvestors | null>(initialLoan);
	let paymentMethods = $state<PaymentMethod[]>([]);
	let loanFetchKey = $state(0);
	let isEditing = $state(false);
	let showDeleteDialog = $state(false);
	let showCompleteDialog = $state(false);
	let isDeleting = $state(false);
	let isCompleting = $state(false);
	let isDownloadingContract = $state(false);
	let quickPaymentKind = $state<LoanQuickPaymentKind | null>(null);
	let investors = $state<Investor[]>([]);
	let borrowers = $state<Borrower[]>([]);
	let loadingFormData = $state(false);

	$effect(() => {
		if (!open || !initialLoan?.id) return;
		loan = initialLoan;
		paymentMethods = [];
		isEditing = startInEditMode;
		void fetchLoanData(initialLoan.id);
	});

	$effect(() => {
		if (!open) {
			isEditing = false;
			paymentMethods = [];
		}
	});

	const isOverdue = $derived(loan?.status === 'Overdue');
	const isPartiallyFunded = $derived(loan?.status === 'Partially Funded');

	async function fetchLoanData(loanId: number) {
		try {
			const response = await fetch(`/api/loans/${loanId}`);
			if (!response.ok) throw new Error('Failed to fetch loan');
			const payload = (await response.json()) as LoanWithInvestors & {
				paymentMethods?: PaymentMethod[];
			};
			const { paymentMethods: nextMethods, ...rest } = payload;
			loan = rest;
			paymentMethods = Array.isArray(nextMethods) ? nextMethods : [];
			loanFetchKey += 1;
		} catch (error) {
			console.error('Error fetching loan:', error);
		}
	}

	async function refreshLoan() {
		if (!loan?.id) return;
		await fetchLoanData(loan.id);
		await onUpdate?.();
	}

	async function loadFormData() {
		if (investors.length > 0 && borrowers.length > 0) return;
		loadingFormData = true;
		try {
			const [investorRes, borrowerRes] = await Promise.all([
				fetch('/api/investors?simple=true'),
				fetch('/api/borrowers?simple=true')
			]);
			const investorData = await investorRes.json();
			const borrowerData = await borrowerRes.json();
			if (Array.isArray(investorData)) investors = investorData;
			if (Array.isArray(borrowerData)) borrowers = borrowerData;
		} catch (error) {
			console.error('Failed to load loan form data', error);
			toast.error('Failed to load form data');
		} finally {
			loadingFormData = false;
		}
	}

	async function enterEditMode() {
		await loadFormData();
		isEditing = true;
	}

	function handlePayBalance() {
		document
			.getElementById('investors-section')
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	async function handleDuplicate() {
		if (!loan) return;
		let sourceLoan = loan;
		try {
			const response = await fetch(`/api/loans/${loan.id}`);
			if (response.ok) sourceLoan = (await response.json()) as LoanWithInvestors;
		} catch {
			// Fall back to loaded loan.
		}
		const duplicateData = createDuplicateDataFromLoan(sourceLoan);
		onOpenChange(false);
		if (onDuplicate) {
			setTimeout(() => {
				void onDuplicate(duplicateData);
			}, 150);
		}
	}

	async function handleDownloadContract() {
		if (!loan) return;
		isDownloadingContract = true;
		try {
			await downloadLoanContract(loan);
		} finally {
			isDownloadingContract = false;
		}
	}

	async function handleDelete() {
		if (!loan) return;
		isDeleting = true;
		try {
			const response = await fetch(`/api/loans/${loan.id}`, { method: 'DELETE' });
			if (!response.ok) throw new Error('Failed to delete loan');
			showDeleteDialog = false;
			onOpenChange(false);
			await onUpdate?.();
		} catch (error) {
			console.error('Error deleting loan:', error);
			toast.error('Failed to delete loan');
		} finally {
			isDeleting = false;
		}
	}

	async function handleComplete() {
		if (!loan) return;
		isCompleting = true;
		try {
			const response = await fetch(`/api/loans/${loan.id}/status`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: 'Completed' })
			});
			if (!response.ok) throw new Error('Failed to complete loan');
			showCompleteDialog = false;
			await refreshLoan();
		} catch (error) {
			console.error('Error completing loan:', error);
			toast.error('Failed to complete loan');
		} finally {
			isCompleting = false;
		}
	}

	async function handleEditSuccess() {
		isEditing = false;
		await refreshLoan();
	}
</script>

{#if loan}
	{@const modalLoan = loan}
	<Dialog.Root {open} onOpenChange={(next) => onOpenChange(next)}>
		<Dialog.Content class="max-h-[90vh] max-w-4xl overflow-y-auto" showCloseButton={false}>
			{#if isEditing}
				<Dialog.Header class="sr-only">
					<Dialog.Title>Edit Loan - {formatText(modalLoan.loanName)}</Dialog.Title>
				</Dialog.Header>
			{:else}
				<Dialog.Header>
					<div class="flex flex-col items-start justify-between gap-3 md:flex-row md:gap-4">
						<Dialog.Title class="line-clamp-2 text-lg font-semibold md:line-clamp-none md:text-xl">
							{formatText(modalLoan.loanName)}
						</Dialog.Title>
						<DetailModalHeader
							onEdit={enterEditMode}
							onDelete={() => (showDeleteDialog = true)}
							onClose={() => onOpenChange(false)}
							onPayBalance={handlePayBalance}
							showPayBalance={!readOnly && isPartiallyFunded}
							onComplete={() => (showCompleteDialog = true)}
							showComplete={!readOnly && isOverdue}
							onDuplicate={handleDuplicate}
							showDuplicate={!readOnly}
							onDownloadContract={handleDownloadContract}
							showDownloadContract={true}
							{isDownloadingContract}
							canEdit={!readOnly}
							canDelete={!readOnly}
							onAddPayment={readOnly ? undefined : () => (quickPaymentKind = 'payment')}
							onAddReceivedPayment={
								readOnly ? undefined : () => (quickPaymentKind = 'received')
							}
						/>
					</div>
				</Dialog.Header>
			{/if}

			<div class={isEditing ? '' : 'mt-3'}>
				{#if isEditing}
					{#if loadingFormData}
						<FormPageSkeleton />
					{:else}
						{#key `loan-form-edit-${modalLoan.id}-${loanFetchKey}`}
							<LoanForm
								{investors}
								{borrowers}
								existingLoan={modalLoan}
								onSuccess={handleEditSuccess}
								onCancel={() => (isEditing = false)}
							/>
						{/key}
					{/if}
				{:else}
					<div class="dashboard-stack">
						<LoanDetailContent
							loan={modalLoan}
							showHeader={false}
							onRefresh={refreshLoan}
							loanId={modalLoan.id}
							readOnly={readOnly}
							{paymentMethods}
						/>
						{#if !readOnly}
							<LoanSigningSection loanId={modalLoan.id} refreshKey={loanFetchKey} />
						{/if}
					</div>
				{/if}
			</div>
		</Dialog.Content>
	</Dialog.Root>

	{#if !readOnly}
		<LoanQuickPaymentDialog
			loan={modalLoan}
			kind={quickPaymentKind}
			open={quickPaymentKind !== null}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) quickPaymentKind = null;
			}}
			onSuccess={refreshLoan}
		/>
	{/if}

	<AlertDialog.Root open={showDeleteDialog} onOpenChange={(v) => (showDeleteDialog = v)}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Delete Loan</AlertDialog.Title>
				<AlertDialog.Description>
					Are you sure you want to delete this loan? This action cannot be undone and will remove
					all associated investor allocations.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action
					class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					disabled={isDeleting}
					onclick={handleDelete}
				>
					{isDeleting ? 'Deleting...' : 'Delete'}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>

	<AlertDialog.Root open={showCompleteDialog} onOpenChange={(v) => (showCompleteDialog = v)}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Complete Loan</AlertDialog.Title>
				<AlertDialog.Description>
					Are you sure you want to mark this loan as completed? This will change the loan status to
					'Completed'.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel disabled={isCompleting}>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action
					class="bg-green-600 hover:bg-green-700"
					disabled={isCompleting}
					onclick={handleComplete}
				>
					{isCompleting ? 'Completing...' : 'Complete'}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
