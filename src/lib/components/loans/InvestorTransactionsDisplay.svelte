<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { Loader2 } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { formatCurrency, formatText } from '$lib/format';
	import { priceVisibility } from '$lib/stores/price-visibility.svelte';
	import { toast } from '$lib/toast';
	import ConfirmDeleteDialog from '$lib/components/common/ConfirmDeleteDialog.svelte';
	import {
		type InvestorWithTransactions,
		computeLoanTotalPrincipal,
		computeInvestorMetrics,
		sectionKey,
		type ReceivedPaymentDisplay
	} from './investor-transactions-helpers';
	import InvestorDisbursementsSection from './InvestorDisbursementsSection.svelte';
	import InvestorInterestSection from './InvestorInterestSection.svelte';
	import ReceiptUploadField from '$lib/components/common/ReceiptUploadField.svelte';
	import PaymentNotesField from '$lib/components/payments/PaymentNotesField.svelte';
	import { hasPaymentReceipt, RECEIPT_REQUIRED_ERROR, type PaymentReceipt } from '$lib/payment-receipts';
	import { scrollFieldIntoView } from '$lib/scroll-field';
	import { todayKey, toDateKey } from '$lib/dates/business-date';

	interface Props {
		investorsWithTransactions: InvestorWithTransactions[];
		showEmail?: boolean;
		loanId?: number;
		onRefresh?: () => void | Promise<void>;
		showPeriodStatus?: boolean;
		readOnly?: boolean;
		editableInvestorIds?: number[] | null;
	}

	let {
		investorsWithTransactions,
		showEmail = true,
		loanId,
		onRefresh,
		showPeriodStatus = true,
		readOnly = false,
		editableInvestorIds = null
	}: Props = $props();

	function canEditInvestor(investorId: number) {
		if (readOnly && editableInvestorIds == null) return false;
		if (editableInvestorIds == null) return !readOnly;
		return editableInvestorIds.includes(investorId);
	}

	$effect(() => {
		void priceVisibility.pricesHidden;
	});

	let payingTransactions = $state(new Set<number | string>());
	let completingPeriods = $state(new Set<number | string>());
	let deletingPaymentIds = $state(new Set<number>());
	let editingPaymentPeriodIds = $state(new Set<number>());
	let openSections = $state<Record<string, boolean>>({});

	let completeModal = $state<{
		periodId: number;
		amount: string;
		receivedDate: string;
		expectedInterest: number;
		receipts: PaymentReceipt[];
		notes: string;
	} | null>(null);

	let editPaymentModal = $state<{
		periodId: number;
		mode: 'single' | 'consolidate' | 'general';
		paymentId: number | null;
		amount: string;
		receivedDate: string;
		expectedInterest: number;
		receipts: PaymentReceipt[];
		notes: string;
	} | null>(null);

	let promptedCompleteReceipt = $state<number | null>(null);
	let promptedConsolidateReceipt = $state<number | null>(null);

	$effect(() => {
		const periodId = completeModal?.periodId ?? null;
		const missing = Boolean(completeModal && !hasPaymentReceipt(completeModal));
		if (!periodId || !missing) {
			if (!completeModal && promptedCompleteReceipt !== null) promptedCompleteReceipt = null;
			return;
		}
		if (promptedCompleteReceipt === periodId) return;
		promptedCompleteReceipt = periodId;
		queueMicrotask(() => scrollFieldIntoView(`receipt-period-${periodId}`, { block: 'nearest' }));
	});

	$effect(() => {
		const modal = editPaymentModal;
		const periodId = modal?.periodId ?? null;
		const missing = Boolean(modal && modal.mode === 'consolidate' && !hasPaymentReceipt(modal));
		if (!periodId || !missing) {
			if (!modal && promptedConsolidateReceipt !== null) promptedConsolidateReceipt = null;
			return;
		}
		if (promptedConsolidateReceipt === periodId) return;
		promptedConsolidateReceipt = periodId;
		queueMicrotask(() =>
			scrollFieldIntoView(`receipt-consolidate-${periodId}`, { block: 'nearest' })
		);
	});

	const loanTotalPrincipal = $derived(computeLoanTotalPrincipal(investorsWithTransactions));

	function isSectionOpen(investorId: number, section: 'principal' | 'interest'): boolean {
		return openSections[sectionKey(investorId, section)] !== false;
	}

	function setSectionOpen(investorId: number, section: 'principal' | 'interest', open: boolean) {
		openSections = { ...openSections, [sectionKey(investorId, section)]: open };
	}

	async function handlePayTransaction(transactionId: number | string) {
		if (!loanId || typeof transactionId !== 'number') return;
		payingTransactions = new Set(payingTransactions).add(transactionId);
		try {
			const response = await fetch(`/api/loans/${loanId}/pay-transaction`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ transactionId })
			});
			if (!response.ok) throw new Error('Failed to pay transaction');
			toast.success('Transaction marked as paid');
			await onRefresh?.();
		} catch (error) {
			console.error('Error paying transaction:', error);
			toast.error('Failed to pay transaction. Please try again.');
		} finally {
			const next = new Set(payingTransactions);
			next.delete(transactionId);
			payingTransactions = next;
		}
	}

	function openCompleteModal(
		periodId: number,
		fullInterestForPeriod: number,
		suggestedPaymentAmount: number
	) {
		const today = todayKey();
		const pay = Math.max(0, suggestedPaymentAmount);
		completeModal = {
			periodId,
			amount: pay.toFixed(2),
			receivedDate: today,
			expectedInterest: fullInterestForPeriod,
			receipts: [],
			notes: ''
		};
	}

	async function handleCompletePeriod() {
		if (!completeModal) return;
		const { periodId, amount, receivedDate, receipts, notes } = completeModal;
		const trimmedDate = receivedDate?.trim() ?? '';
		const parsed = parseFloat(amount);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			toast.error('Enter a valid received amount.');
			return;
		}
		if (!trimmedDate) {
			toast.error('Choose a received date.');
			return;
		}
		if (!hasPaymentReceipt({ receipts })) {
			toast.error('Upload a receipt.');
			return;
		}

		completingPeriods = new Set(completingPeriods).add(periodId);
		try {
			const response = await fetch(`/api/interest-periods/${periodId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					status: 'Completed',
					receivedAmount: parsed,
					receivedDate: trimmedDate,
					receipts,
					notes: notes.trim() || null
				})
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				toast.error(
					typeof data.error === 'string'
						? data.error
						: 'Could not record this payment. Please try again.'
				);
				return;
			}
			if (data.status === 'Incomplete') {
				toast.success(
					'Partial payment recorded. Period stays incomplete until the full interest is paid.'
				);
			} else {
				toast.success('Period marked as complete.');
			}
			completeModal = null;
			await onRefresh?.();
		} catch (error) {
			console.error('Error completing period:', error);
			toast.error('Could not complete this period. Please try again.');
		} finally {
			const next = new Set(completingPeriods);
			next.delete(periodId);
			completingPeriods = next;
		}
	}

	function openEditPaymentModal(
		periodId: number,
		periodInterest: number,
		linkedRows: {
			id?: number;
			amount: string;
			receivedDate: string;
			notes?: string | null;
		}[]
	) {
		const today = todayKey();
		if (linkedRows.length === 0) {
			editPaymentModal = {
				periodId,
				mode: 'consolidate',
				paymentId: null,
				amount: periodInterest.toFixed(2),
				receivedDate: today,
				expectedInterest: periodInterest,
				receipts: [],
				notes: ''
			};
			return;
		}
		const sum = linkedRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
		const last = linkedRows[linkedRows.length - 1];
		const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(last.receivedDate)
			? last.receivedDate
			: toDateKey(last.receivedDate);
		const single = linkedRows.length === 1 && typeof linkedRows[0].id === 'number';
		editPaymentModal = {
			periodId,
			mode: single ? 'single' : 'consolidate',
			paymentId: single ? linkedRows[0].id! : null,
			amount: sum.toFixed(2),
			receivedDate: dateStr,
			expectedInterest: periodInterest,
			receipts: [],
			notes: (single ? linkedRows[0]?.notes : last.notes) ?? ''
		};
	}

	function openGeneralPayment(payment: ReceivedPaymentDisplay) {
		if (payment.id == null) return;
		const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(payment.receivedDate)
			? payment.receivedDate
			: toDateKey(payment.receivedDate);
		editPaymentModal = {
			periodId: payment.id,
			mode: 'general',
			paymentId: payment.id,
			amount: payment.amount,
			receivedDate: dateStr,
			expectedInterest: 0,
			receipts: payment.receipts ?? [],
			notes: payment.notes ?? ''
		};
	}

	async function handleEditPaymentSave() {
		if (!editPaymentModal) return;
		const { periodId, mode, paymentId, amount, receivedDate, receipts, notes } = editPaymentModal;
		const trimmedDate = receivedDate?.trim() ?? '';
		const parsed = parseFloat(amount);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			toast.error('Enter a valid received amount.');
			return;
		}
		if (!trimmedDate) {
			toast.error('Choose a received date.');
			return;
		}
		if (mode === 'consolidate' && !hasPaymentReceipt({ receipts })) {
			toast.error('Upload a receipt.');
			return;
		}

		editingPaymentPeriodIds = new Set(editingPaymentPeriodIds).add(periodId);
		try {
			if ((mode === 'single' || mode === 'general') && paymentId != null) {
				const response = await fetch(`/api/received-payments/${paymentId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						amount: parsed,
						receivedDate: trimmedDate,
						receipts,
						notes: notes.trim() || null
					})
				});
				const data = await response.json().catch(() => ({}));
				if (!response.ok) {
					toast.error(typeof data.error === 'string' ? data.error : 'Could not update payment.');
					return;
				}
			} else {
				const response = await fetch(`/api/interest-periods/${periodId}/consolidate-payment`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						amount: parsed,
						receivedDate: trimmedDate,
						receipts,
						notes: notes.trim() || null
					})
				});
				const data = await response.json().catch(() => ({}));
				if (!response.ok) {
					toast.error(typeof data.error === 'string' ? data.error : 'Could not update payments.');
					return;
				}
			}
			toast.success('Payment updated.');
			editPaymentModal = null;
			await onRefresh?.();
		} catch (error) {
			console.error('Error updating payment:', error);
			toast.error('Could not update payment.');
		} finally {
			const next = new Set(editingPaymentPeriodIds);
			next.delete(periodId);
			editingPaymentPeriodIds = next;
		}
	}

	let pendingDeletePaymentId = $state<number | null>(null);

	function handleDeleteReceivedPayment(paymentId: number) {
		pendingDeletePaymentId = paymentId;
	}

	async function performDeleteReceivedPayment(paymentId: number) {
		deletingPaymentIds = new Set(deletingPaymentIds).add(paymentId);
		try {
			const response = await fetch(`/api/received-payments/${paymentId}`, { method: 'DELETE' });
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				toast.error(typeof data.error === 'string' ? data.error : 'Could not remove this payment.');
				return;
			}
			toast.success('Payment record removed.');
			await onRefresh?.();
		} catch (error) {
			console.error('Error deleting received payment:', error);
			toast.error('Could not remove this payment.');
		} finally {
			const next = new Set(deletingPaymentIds);
			next.delete(paymentId);
			deletingPaymentIds = next;
		}
	}
</script>

<div class="space-y-3">
	{#each investorsWithTransactions as item (item.investor.id)}
		{@const metrics = computeInvestorMetrics(item, loanTotalPrincipal)}
		{@const investor = item.investor}
		{@const transactions = item.transactions}
		{@const canMutate = canEditInvestor(investor.id)}
		{@const principalOpen = isSectionOpen(investor.id, 'principal')}
		{@const interestOpen = isSectionOpen(investor.id, 'interest')}

		<div class="overflow-hidden rounded-lg border border-border/80 bg-card shadow-none">
			<div
				class="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/50 px-3 py-2.5"
			>
				<div class="min-w-0">
					<p class="truncate text-base leading-tight font-semibold">{formatText(investor.name)}</p>
					{#if showEmail && investor.email}
						<p class="mt-0.5 truncate text-xs text-muted-foreground">
							{formatText(investor.email)}
						</p>
					{/if}
				</div>
				{#if metrics.isFullyReceived}
					<Badge
						class="h-5 shrink-0 border-0 bg-green-600 text-[10px] text-white hover:bg-green-600"
					>
						Settled
					</Badge>
				{/if}
			</div>

			<div class="space-y-3 bg-muted/20 p-3">
				<InvestorDisbursementsSection
					transactions={transactions}
					{metrics}
					open={principalOpen}
					onOpenChange={(open) => setSectionOpen(investor.id, 'principal', open)}
					{canMutate}
					{loanId}
					{payingTransactions}
					onPay={handlePayTransaction}
				/>

				<InvestorInterestSection
					{metrics}
					{transactions}
					{loanTotalPrincipal}
					open={interestOpen}
					onOpenChange={(next: boolean) => setSectionOpen(investor.id, 'interest', next)}
					{showPeriodStatus}
					{canMutate}
					{loanId}
					{deletingPaymentIds}
					{completingPeriods}
					{editingPaymentPeriodIds}
					onDeletePayment={handleDeleteReceivedPayment}
					onComplete={openCompleteModal}
					onEditPayment={openEditPaymentModal}
					onEditGeneralPayment={openGeneralPayment}
				/>
			</div>

			<div class="border-t border-border/60 bg-muted/40 px-3 py-2.5">
				<p class="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
					Investor totals
				</p>
				<div class="grid grid-cols-3 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-6">
					<div>
						<p class="text-muted-foreground">Capital</p>
						<p class="text-sm font-medium tabular-nums">{formatCurrency(metrics.totalCapital)}</p>
					</div>
					<div>
						<p class="text-muted-foreground">Total rate</p>
						<p class="text-sm font-medium">{metrics.rateDisplay}</p>
					</div>
					<div>
						<p class="text-muted-foreground">Interest</p>
						<p class="text-sm font-medium tabular-nums">{formatCurrency(metrics.totalInterest)}</p>
					</div>
					<div>
						<p class="text-muted-foreground">Total</p>
						<p class="text-sm font-medium tabular-nums">{formatCurrency(metrics.grandTotal)}</p>
					</div>
					<div>
						<p class="text-muted-foreground">Received</p>
						<p class="text-sm font-medium tabular-nums">
							{formatCurrency(metrics.totalReceived)}
						</p>
					</div>
					<div>
						<p class="text-muted-foreground">Balance</p>
						<p
							class={cn(
								'text-sm font-medium tabular-nums',
								metrics.isFullyReceived && 'text-green-600 dark:text-green-400'
							)}
						>
							{formatCurrency(Math.max(0, metrics.balance))}
						</p>
					</div>
				</div>
			</div>
		</div>
	{/each}
</div>

<ResponsiveModal
	open={!!completeModal}
	onOpenChange={(open) => {
		if (!open) completeModal = null;
	}}
	title="Record interest payment"
	contentClass="sm:max-w-md"
>
	{#snippet footer()}
		<Button
			variant="outline"
			onclick={() => (completeModal = null)}
			disabled={!!completeModal && completingPeriods.has(completeModal.periodId)}
		>
			Cancel
		</Button>
		<Button
			onclick={handleCompletePeriod}
			disabled={!completeModal ||
				!completeModal.amount?.trim() ||
				!completeModal.receivedDate?.trim() ||
				!hasPaymentReceipt(completeModal) ||
				completingPeriods.has(completeModal.periodId)}
		>
			{#if completeModal && completingPeriods.has(completeModal.periodId)}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Saving…
			{:else}
				Confirm
			{/if}
		</Button>
	{/snippet}
	{#if completeModal}
		<div class="space-y-3 py-1">
			<div class="space-y-2">
				<Label for="received-amount">Received amount</Label>
				<Input
					id="received-amount"
					type="number"
					step="0.01"
					value={completeModal.amount}
					oninput={(e) => {
						if (completeModal) {
							completeModal = { ...completeModal, amount: e.currentTarget.value };
						}
					}}
				/>
			</div>
			<div class="space-y-2">
				<Label for="received-date">Received date</Label>
				<Input
					id="received-date"
					type="date"
					value={completeModal.receivedDate}
					oninput={(e) => {
						if (completeModal) {
							completeModal = { ...completeModal, receivedDate: e.currentTarget.value };
						}
					}}
				/>
			</div>
			<ReceiptUploadField
				fieldId="receipt-period-{completeModal.periodId}"
				idPrefix="period-{completeModal.periodId}"
				receipts={completeModal.receipts}
				required
				error={hasPaymentReceipt(completeModal) ? null : RECEIPT_REQUIRED_ERROR}
				disabled={completingPeriods.has(completeModal.periodId)}
				scanContext={{ purpose: 'received_payment', loanId }}
				onChange={(receipts) => {
					if (completeModal) completeModal = { ...completeModal, receipts };
				}}
				onExtracted={(extracted) => {
					// The first receipt shows what was actually paid; it beats the expected amount.
					if (!completeModal || !extracted || completeModal.receipts.length > 1) return;
					completeModal = {
						...completeModal,
						amount: extracted.amount ? String(extracted.amount) : completeModal.amount,
						receivedDate: extracted.transactionDate ?? completeModal.receivedDate
					};
				}}
			/>
			<PaymentNotesField
				id="period-notes-{completeModal.periodId}"
				value={completeModal.notes}
				disabled={completingPeriods.has(completeModal.periodId)}
				onChange={(notes) => {
					if (completeModal) completeModal = { ...completeModal, notes };
				}}
			/>
		</div>
	{/if}
</ResponsiveModal>

<ResponsiveModal
	open={!!editPaymentModal}
	onOpenChange={(open) => {
		if (!open) editPaymentModal = null;
	}}
	title="Edit payment"
	description={editPaymentModal?.mode === 'consolidate'
		? 'This replaces all payment lines for this period with a single entry using the amount and date below.'
		: editPaymentModal?.mode === 'general'
			? 'Update this payment amount, date, receipt, or notes.'
			: undefined}
	contentClass="sm:max-w-md"
>
	{#snippet footer()}
		<Button
			variant="outline"
			onclick={() => (editPaymentModal = null)}
			disabled={!!editPaymentModal && editingPaymentPeriodIds.has(editPaymentModal.periodId)}
		>
			Cancel
		</Button>
		<Button
			onclick={handleEditPaymentSave}
			disabled={!editPaymentModal ||
				!editPaymentModal.amount?.trim() ||
				!editPaymentModal.receivedDate?.trim() ||
				(editPaymentModal.mode !== 'single' && !hasPaymentReceipt(editPaymentModal)) ||
				(editPaymentModal && editingPaymentPeriodIds.has(editPaymentModal.periodId))}
		>
			{#if editPaymentModal && editingPaymentPeriodIds.has(editPaymentModal.periodId)}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Saving…
			{:else}
				Save
			{/if}
		</Button>
	{/snippet}
	{#if editPaymentModal}
		<div class="space-y-3 py-1">
			<div class="space-y-2">
				<Label for="edit-received-amount">Received amount</Label>
				<Input
					id="edit-received-amount"
					type="number"
					step="0.01"
					value={editPaymentModal.amount}
					oninput={(e) => {
						if (editPaymentModal) {
							editPaymentModal = { ...editPaymentModal, amount: e.currentTarget.value };
						}
					}}
				/>
				{#if editPaymentModal.mode !== 'general'}
					<p class="text-[11px] text-muted-foreground">
						Max for this period: {formatCurrency(editPaymentModal.expectedInterest)}
					</p>
				{/if}
			</div>
			<div class="space-y-2">
				<Label for="edit-received-date">Received date</Label>
				<Input
					id="edit-received-date"
					type="date"
					value={editPaymentModal.receivedDate}
					oninput={(e) => {
						if (editPaymentModal) {
							editPaymentModal = { ...editPaymentModal, receivedDate: e.currentTarget.value };
						}
					}}
				/>
			</div>
			<ReceiptUploadField
					fieldId="receipt-consolidate-{editPaymentModal.periodId}"
					idPrefix="consolidate-{editPaymentModal.periodId}"
					receipts={editPaymentModal.receipts}
					required={editPaymentModal.mode !== 'single'}
					error={
						editPaymentModal.mode !== 'single' && !hasPaymentReceipt(editPaymentModal)
							? RECEIPT_REQUIRED_ERROR
							: null
					}
					disabled={editingPaymentPeriodIds.has(editPaymentModal.periodId)}
					scanContext={{ purpose: 'received_payment', loanId }}
					onChange={(receipts) => {
						if (editPaymentModal) editPaymentModal = { ...editPaymentModal, receipts };
					}}
					onExtracted={(extracted) => {
						if (!editPaymentModal || !extracted || editPaymentModal.receipts.length > 1) return;
						editPaymentModal = {
							...editPaymentModal,
							amount: extracted.amount ? String(extracted.amount) : editPaymentModal.amount,
							receivedDate: extracted.transactionDate ?? editPaymentModal.receivedDate
						};
					}}
				/>
			<PaymentNotesField
				id="edit-payment-notes-{editPaymentModal.periodId}"
				value={editPaymentModal.notes}
				disabled={editingPaymentPeriodIds.has(editPaymentModal.periodId)}
				onChange={(notes) => {
					if (editPaymentModal) editPaymentModal = { ...editPaymentModal, notes };
				}}
			/>
		</div>
	{/if}
</ResponsiveModal>

<ConfirmDeleteDialog
	open={pendingDeletePaymentId !== null}
	onOpenChange={(open) => {
		if (!open) pendingDeletePaymentId = null;
	}}
	title="Remove payment?"
	description="Remove this payment record? This cannot be undone. The interest period and loan status will be recalculated."
	onConfirm={async () => {
		const id = pendingDeletePaymentId;
		if (id != null) {
			await performDeleteReceivedPayment(id);
			pendingDeletePaymentId = null;
		}
	}}
/>
