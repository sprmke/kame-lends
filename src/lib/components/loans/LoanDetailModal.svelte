<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import DetailModalHeader from '$lib/components/common/DetailModalHeader.svelte';
	import FormHeader from '$lib/components/common/FormHeader.svelte';
	import LoanDetailContent from './LoanDetailContent.svelte';
	import LoanContractDetailsModal from './LoanContractDetailsModal.svelte';
	import type { Component } from 'svelte';
	import FormPageSkeleton from '$lib/components/common/FormPageSkeleton.svelte';
	import { createOverlayContentReady } from '$lib/composables/use-overlay-content-ready.svelte';
	import DetailModalHeaderSkeleton from '$lib/components/common/page-skeletons/DetailModalHeaderSkeleton.svelte';
	import LoanDetailSkeleton from '$lib/components/common/page-skeletons/LoanDetailSkeleton.svelte';
	import LoanQuickPaymentDialog, {
		type LoanQuickPaymentKind
	} from './LoanQuickPaymentDialog.svelte';
	import { createDuplicateDataFromLoan } from '$lib/loan-duplicate';
	import { formatText } from '$lib/format';
	import { toast } from '$lib/toast';
	import type { Borrower, Investor, LoanWithInvestors, PaymentMethod } from '$lib/types';
	import type { DuplicateLoanData } from '$lib/loan-duplicate';
	import type { LoanAccessContext } from '$lib/loan-access';

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
	let access = $state<LoanAccessContext | null>(null);
	let loanFetchKey = $state(0);
	let isEditing = $state(false);
	let showDeleteDialog = $state(false);
	let showCompleteDialog = $state(false);
	let isDeleting = $state(false);
	let isCompleting = $state(false);
	let showContractDetailsModal = $state(false);
	let quickPaymentKind = $state<LoanQuickPaymentKind | null>(null);
	let investors = $state<Investor[]>([]);
	let borrowers = $state<Borrower[]>([]);
	let loadingFormData = $state(false);
	let isLoadingLoan = $state(false);
	let isSubmitting = $state(false);
	let LoanFormComponent = $state<Component | null>(null);
	let loadingLoanFormModule = $state(false);
	const editOverlayContent = createOverlayContentReady();

	$effect.pre(() => {
		if (initialLoan) loan = initialLoan;
	});

	$effect.pre(() => {
		if (!open) {
			isEditing = false;
			paymentMethods = [];
			access = null;
			return;
		}
		isEditing = startInEditMode && !readOnly;
	});

	$effect(() => {
		if (!open || !initialLoan?.id) {
			if (!open) isLoadingLoan = false;
			return;
		}
		paymentMethods = [];
		isLoadingLoan = true;
		void fetchLoanData(initialLoan.id);
	});

	const isOverdue = $derived(loan?.status === 'Overdue');
	const isPartiallyFunded = $derived(loan?.status === 'Partially Funded');
	const editFormId = $derived(loan ? `loan-edit-form-${loan.id}` : undefined);
	const editSubmitLabel = $derived(isSubmitting ? 'Updating...' : 'Update Loan');

	async function fetchLoanData(loanId: number) {
		try {
			const response = await fetch(`/api/loans/${loanId}`);
			if (!response.ok) throw new Error('Failed to fetch loan');
			const payload = (await response.json()) as LoanWithInvestors & {
				paymentMethods?: PaymentMethod[];
				access?: LoanAccessContext;
			};
			const { paymentMethods: nextMethods, access: nextAccess, ...rest } = payload;
			loan = rest;
			paymentMethods = Array.isArray(nextMethods) ? nextMethods : [];
			access = nextAccess ?? null;
			loanFetchKey += 1;
		} catch (error) {
			console.error('Error fetching loan:', error);
		} finally {
			isLoadingLoan = false;
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

	function enterEditMode() {
		isEditing = true;
	}

	$effect(() => {
		if (!open || !isEditing) return;
		void loadFormData();
	});

	$effect(() => {
		editOverlayContent.armWhenOpen(open && isEditing);
	});

	$effect(() => {
		if (!open || !isEditing || loadingFormData || !editOverlayContent.ready) {
			if (!open || !isEditing) {
				LoanFormComponent = null;
				loadingLoanFormModule = false;
			}
			return;
		}

		if (LoanFormComponent) return;

		loadingLoanFormModule = true;
		void import('./LoanForm.svelte').then((mod) => {
			LoanFormComponent = mod.default;
			loadingLoanFormModule = false;
		});
	});

	const showEditFormSkeleton = $derived(
		loadingFormData || !editOverlayContent.ready || loadingLoanFormModule || !LoanFormComponent
	);

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

<ResponsiveModal
	{open}
	onOpenChange={(next) => onOpenChange(next)}
	showCloseButton={false}
	contentClass="dashboard-dialog-wide !max-w-4xl"
>
	{#snippet header()}
		{#if isLoadingLoan && !isEditing}
			<DetailModalHeaderSkeleton />
		{:else if loan}
			{#if isEditing}
				<FormHeader
					title={formatText(loan.loanName)}
					description="Update loan details and investor allocations"
					formId={editFormId}
					onCancel={() => (isEditing = false)}
					{isSubmitting}
					isEditMode={true}
					submitLabel={editSubmitLabel}
					variant="embedded"
				/>
			{:else}
				<div class="flex items-start justify-between gap-3 md:gap-4">
					<h2
						class="min-w-0 flex-1 text-base font-medium tracking-tight line-clamp-2 md:line-clamp-none"
					>
						{formatText(loan.loanName)}
					</h2>
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
						onContractDetails={() => (showContractDetailsModal = true)}
						canEdit={!readOnly}
						canDelete={!readOnly}
						onAddPayment={readOnly ? undefined : () => (quickPaymentKind = 'payment')}
						onAddReceivedPayment={readOnly ? undefined : () => (quickPaymentKind = 'received')}
					/>
				</div>
			{/if}
		{/if}
	{/snippet}

	{#if isLoadingLoan && !isEditing}
		<LoanDetailSkeleton />
	{:else if loan}
		{@const modalLoan = loan}
		<div>
			{#if isEditing}
				{#if showEditFormSkeleton}
					<FormPageSkeleton />
				{:else}
					{#key `loan-form-edit-${modalLoan.id}-${loanFetchKey}`}
						<LoanFormComponent
							{investors}
							{borrowers}
							existingLoan={modalLoan}
							formId={editFormId}
							showFormHeader={false}
							bind:isSubmitting
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
						access={access ?? undefined}
					/>
				</div>
			{/if}
		</div>
	{/if}
</ResponsiveModal>

	{#if loan}
		<LoanContractDetailsModal
			loan={loan}
			open={showContractDetailsModal}
			onOpenChange={(next) => (showContractDetailsModal = next)}
			canEdit={!readOnly}
			{borrowers}
			{investors}
			onSaved={refreshLoan}
		/>
	{/if}

	{#if loan && !readOnly}
		<LoanQuickPaymentDialog
			loan={loan}
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
					class="bg-chart-2 text-white hover:bg-chart-2/90"
					disabled={isCompleting}
					onclick={handleComplete}
				>
					{isCompleting ? 'Completing...' : 'Complete'}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>

