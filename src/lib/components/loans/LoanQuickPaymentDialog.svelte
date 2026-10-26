<script lang="ts">
	import { untrack } from 'svelte';
	import { CalendarDays, Plus } from 'lucide-svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Tabs from '$lib/components/ui/tabs';
	import PaymentEntryFields from '$lib/components/payments/PaymentEntryFields.svelte';
	import ReceiptIntake from '$lib/components/receipt-scan/ReceiptIntake.svelte';
	import ScanRowActions from '$lib/components/receipt-scan/ScanRowActions.svelte';
	import ScanRowNotes from '$lib/components/receipt-scan/ScanRowNotes.svelte';
	import { calculateTotalAmount } from '$lib/calculations';
	import { toLocalDateString } from '$lib/date-utils';
	import { formatCurrency, formatDate } from '$lib/format';
	import { toast } from '$lib/toast';
	import type { LoanWithInvestors } from '$lib/types';
	import ReceiptUploadField from '$lib/components/common/ReceiptUploadField.svelte';
	import type { ReceiptExtractedData } from '$lib/receipt-extraction-types';
	import { hasPaymentReceipt, RECEIPT_REQUIRED_ERROR, type PaymentReceipt } from '$lib/payment-receipts';
	import { scrollFieldIntoView } from '$lib/scroll-field';
	import type { ReceiptScanContext } from '$lib/receipt-extraction-client';
	import {
		groupScannedReceipts,
		type ProposedTransaction,
		type ScannedReceipt
	} from '$lib/receipt-scan/group-transactions';
	import {
		addProposalsToRows,
		mergeRowWithPrevious,
		splitRowAt,
		type RowAdapter,
		type RowScanMeta
	} from '$lib/receipt-scan/rows';
	import { findMatchingParty } from '$lib/receipt-scan/match-party';
	import { suggestInterestPeriodId } from '$lib/receipt-scan/suggest-period';

	export type LoanQuickPaymentKind = 'payment' | 'received';

	interface PaymentEntry {
		id: string;
		investorId: string;
		amount: string;
		date: string;
		dateTouched: boolean;
		interestType: 'rate' | 'fixed';
		interestValue: string;
		isPaid: boolean;
		interestPeriodId: string;
		receipts: PaymentReceipt[];
		notes: string;
		/** AI notes when the row was created from receipts. */
		scan: RowScanMeta | null;
	}

	interface Props {
		loan: LoanWithInvestors | null;
		kind: LoanQuickPaymentKind | null;
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSuccess?: () => void | Promise<void>;
		/** When set, only these investor IDs appear as payment targets. */
		allowedInvestorIds?: number[] | null;
	}

	let {
		loan,
		kind,
		open,
		onOpenChange,
		onSuccess,
		allowedInvestorIds = null
	}: Props = $props();

	let formEl = $state<HTMLFormElement | null>(null);

	function createPaymentEntry(defaultInvestorId = ''): PaymentEntry {
		return {
			id: crypto.randomUUID(),
			investorId: defaultInvestorId,
			amount: '',
			date: toLocalDateString(new Date()),
			dateTouched: false,
			interestType: 'rate',
			interestValue: '10',
			isPaid: true,
			interestPeriodId: 'general',
			receipts: [],
			notes: '',
			scan: null
		};
	}

	function handleReceiptExtracted(entryId: string, extracted: ReceiptExtractedData | null) {
		const entry = entries.find((item) => item.id === entryId);
		if (!entry || !extracted) return;

		const changes: Partial<PaymentEntry> = {};

		if (!entry.amount && extracted.amount) {
			changes.amount = String(extracted.amount);
		}
		if (!entry.dateTouched && extracted.transactionDate) {
			changes.date = extracted.transactionDate;
		}
		if (!entry.investorId) {
			// Lender sends principal; for repayments the lender is the receiver.
			const match = findMatchingParty(
				isReceived ? extracted.receiverName : extracted.senderName,
				lenders
			);
			if (match) {
				changes.investorId = String(match.id);
			}
		}

		if (Object.keys(changes).length > 0) {
			updateEntry(entryId, changes);
		}
	}

	const scanContext = $derived<ReceiptScanContext>({
		purpose: kind === 'received' ? 'received_payment' : 'fund_transfer',
		loanId: loan?.id
	});

	function periodOptionsFor(investorId: string) {
		if (!isReceived) return null;
		const context = getEntryContext({ ...createPaymentEntry(), investorId });
		if (context.periods.length === 0) return null;
		return [
			{ value: 'general', label: 'General loan balance' },
			...context.periods.map((period) => ({
				value: String(period.id),
				label: `Interest due ${formatDate(period.dueDate)}`
			}))
		];
	}

	function suggestPeriod(investorId: number, amount: number | null) {
		if (!loan || !isReceived) return 'general';
		const payments = loan.loanInvestors.filter((payment) => payment.investor.id === investorId);
		const capital = payments.reduce(
			(sum, payment) => sum + (Number.parseFloat(payment.amount) || 0),
			0
		);
		return suggestInterestPeriodId(
			amount,
			payments.flatMap((payment) => payment.interestPeriods ?? []),
			capital
		);
	}

	/** A new row for a lender, with interest copied from that lender's latest disbursement. */
	function newEntryFor(investorId: number | null): PaymentEntry {
		const entry = createPaymentEntry(investorId !== null ? String(investorId) : '');
		const latest = loan?.loanInvestors
			.filter((payment) => payment.investor.id === investorId)
			.sort((a, b) => new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime())[0];
		if (!latest) return entry;
		return {
			...entry,
			interestType: latest.interestType === 'fixed' ? 'fixed' : 'rate',
			interestValue: latest.interestRate
		};
	}

	const rowAdapter: RowAdapter<PaymentEntry> = {
		getId: (entry) => entry.id,
		read: (entry) => ({
			investorId: entry.investorId ? Number(entry.investorId) : null,
			amount: entry.amount,
			date: entry.date,
			receipts: entry.receipts,
			interestPeriodId: entry.interestPeriodId,
			scan: entry.scan
		}),
		write: (base, fields) => ({
			...(base ?? newEntryFor(fields.investorId)),
			investorId: fields.investorId !== null ? String(fields.investorId) : '',
			amount: fields.amount,
			date: fields.date || base?.date || toLocalDateString(new Date()),
			dateTouched: true,
			interestPeriodId: fields.interestPeriodId ?? base?.interestPeriodId ?? 'general',
			receipts: fields.receipts,
			scan: fields.scan
		})
	};

	function withSuggestedPeriods(proposals: ProposedTransaction[]) {
		if (!isReceived) return proposals;
		return proposals.map((proposal) => ({
			...proposal,
			interestPeriodId:
				proposal.investorId !== null
					? suggestPeriod(proposal.investorId, proposal.amount ? Number(proposal.amount) : null)
					: 'general'
		}));
	}

	/** Receipts → one row per transaction, receipts attached. */
	function addFromReceipts(proposals: ProposedTransaction[]) {
		entries = addProposalsToRows(entries, proposals, rowAdapter);
	}

	/** A row's own upload turned out to hold several transfers: split it in place. */
	function splitEntryFromScan(entry: PaymentEntry, scanned: ScannedReceipt[]) {
		const { proposals } = groupScannedReceipts(scanned, {
			purpose: scanContext.purpose,
			lenders,
			defaultInvestorId: entry.investorId ? Number(entry.investorId) : null,
			currentLoanId: loan?.id ?? null
		});
		entries = addProposalsToRows(entries, withSuggestedPeriods(proposals), rowAdapter, {
			sourceId: entry.id,
			scannedImageUrls: scanned
				.map((item) => item.receipt?.imageUrl)
				.filter((url): url is string => Boolean(url))
		});
	}

	const lenders = $derived.by(() => {
		if (!loan) return [];
		const unique = new Map(
			loan.loanInvestors.map((payment) => [payment.investor.id, payment.investor])
		);
		let list = Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
		if (allowedInvestorIds && allowedInvestorIds.length > 0) {
			const allow = new Set(allowedInvestorIds);
			list = list.filter((investor) => allow.has(investor.id));
		}
		return list;
	});

	/** One blank row on open so amount, date, and lender can be filled before the receipt. */
	let entries = $state<PaymentEntry[]>([]);
	let isSubmitting = $state(false);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			const investorId = lenders.length === 1 ? lenders[0].id : null;
			entries = [newEntryFor(investorId)];
		});
	});

	function addBlankEntry() {
		const investorId = lenders.length === 1 ? lenders[0].id : null;
		entries = [...entries, newEntryFor(investorId)];
	}

	function getEntryContext(entry: PaymentEntry) {
		if (!loan) {
			return {
				selectedInvestorId: 0,
				usesInterestSchedule: false,
				periods: [] as Array<{ id: number; dueDate: Date | string }>,
				remaining: 0
			};
		}

		const selectedInvestorId = Number.parseInt(entry.investorId, 10);
		const selectedPayments = loan.loanInvestors.filter(
			(payment) => payment.investor.id === selectedInvestorId
		);
		const usesInterestSchedule = selectedPayments.some(
			(payment) => payment.hasMultipleInterest && (payment.interestPeriods?.length ?? 0) > 0
		);
		const periods = selectedPayments
			.flatMap((payment) => payment.interestPeriods ?? [])
			.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
		const totalDue = selectedPayments.length ? calculateTotalAmount(selectedPayments) : 0;
		const totalReceived = selectedPayments
			.flatMap((payment) => payment.receivedPayments ?? [])
			.reduce((sum, payment) => sum + (Number.parseFloat(payment.amount) || 0), 0);

		return {
			selectedInvestorId,
			usesInterestSchedule,
			periods,
			remaining: Math.max(0, totalDue - totalReceived)
		};
	}

	const isReceived = $derived(kind === 'received');
	const title = $derived(isReceived ? 'Add Received Payment' : 'Fund Transfer');

	const canSubmit = $derived(
		loan &&
			kind &&
			entries.length > 0 &&
			entries.every((entry) => {
				const context = getEntryContext(entry);
				return (
					Boolean(entry.investorId) &&
					Number.parseFloat(entry.amount) > 0 &&
					Boolean(entry.date) &&
					hasPaymentReceipt(entry) &&
					(isReceived ||
						context.usesInterestSchedule ||
						Number.parseFloat(entry.interestValue) >= 0)
				);
			})
	);

	let promptedReceiptId = $state<string | null>(null);

	function receiptFieldError(entry: PaymentEntry): string | null {
		if (!(Number.parseFloat(entry.amount) > 0) || !entry.date?.trim() || hasPaymentReceipt(entry)) {
			return null;
		}
		return RECEIPT_REQUIRED_ERROR;
	}

	$effect(() => {
		if (!open || !kind) {
			if (promptedReceiptId !== null) promptedReceiptId = null;
			return;
		}
		const entry = entries.find((item) => receiptFieldError(item));
		const id = entry ? `receipt-${kind}-${entry.id}` : null;
		if (!id || id === promptedReceiptId) return;
		promptedReceiptId = id;
		queueMicrotask(() => scrollFieldIntoView(id, { block: 'nearest' }));
	});

	const lenderOptions = $derived(
		lenders.map((lender) => ({ value: String(lender.id), label: lender.name }))
	);

	function updateEntry(id: string, changes: Partial<PaymentEntry>) {
		entries = entries.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry));
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!loan || !kind || !canSubmit) {
			return;
		}

		isSubmitting = true;
		let savedCount = 0;
		try {
			for (const entry of entries) {
				const context = getEntryContext(entry);
				const isPeriodPayment = isReceived && entry.interestPeriodId !== 'general';
				const endpoint = isPeriodPayment
					? `/api/interest-periods/${entry.interestPeriodId}`
					: isReceived
						? `/api/loans/${loan.id}/received-payments`
						: `/api/loans/${loan.id}/payments`;
				const receiptFields = {
					receipts: entry.receipts,
					notes: entry.notes.trim() || null
				};
				const payload = isPeriodPayment
					? {
							status: 'Completed',
							receivedAmount: Number.parseFloat(entry.amount),
							receivedDate: entry.date,
							...receiptFields
						}
					: isReceived
						? {
								investorId: context.selectedInvestorId,
								amount: entry.amount,
								receivedDate: entry.date,
								interestPeriodId: null,
								...receiptFields
							}
						: {
								investorId: context.selectedInvestorId,
								amount: entry.amount,
								sentDate: entry.date,
								interestType: entry.interestType,
								interestValue: entry.interestValue,
								isPaid: entry.isPaid,
								...receiptFields
							};

				const response = await fetch(endpoint, {
					method: isPeriodPayment ? 'PATCH' : 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const result = await response.json().catch(() => null);
				if (!response.ok) {
					throw new Error(result?.error || `Failed to add ${title.toLowerCase()}.`);
				}
				savedCount += 1;
			}

			toast.success(
				`${savedCount} ${isReceived ? 'received payment' : 'principal payment'}${savedCount === 1 ? '' : 's'} added.`
			);
			onOpenChange(false);
			await onSuccess?.();
		} catch (error) {
			if (savedCount > 0) {
				entries = entries.slice(savedCount);
				await onSuccess?.();
			}
			toast.error(
				`${savedCount ? `${savedCount} saved. ` : ''}${
					error instanceof Error ? error.message : 'Unable to save the payment.'
				}`
			);
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if loan && kind}
	<ResponsiveModal
		{open}
		onOpenChange={(next) => !isSubmitting && onOpenChange(next)}
		{title}
		description={isReceived
			? `Record money received from the borrower for ${loan.loanName}.`
			: `Record an additional principal disbursement for ${loan.loanName}.`}
		contentClass="sm:max-w-2xl"
	>
		{#snippet footer()}
			<Button
				type="button"
				variant="outline"
				disabled={isSubmitting}
				onclick={() => onOpenChange(false)}
			>
				Cancel
			</Button>
			<Button
				type="button"
				disabled={!canSubmit || isSubmitting}
				onclick={() => formEl?.requestSubmit()}
			>
				{isSubmitting
					? `Saving ${entries.length}...`
					: `${title}${entries.length > 1 ? `s (${entries.length})` : ''}`}
			</Button>
		{/snippet}
		<form bind:this={formEl} class="space-y-4" onsubmit={handleSubmit}>
			{#each entries as entry, index (entry.id)}
				{@const context = getEntryContext(entry)}
				{@const rowLabel = `${isReceived ? 'Payment' : 'Transfer'} ${index + 1}`}
				<div
					class="space-y-4 rounded-xl border border-border bg-muted/20 p-4"
					data-testid="payment-entry"
				>
					<div class="flex items-center justify-between gap-3">
						<p class="text-sm font-semibold">{rowLabel}</p>
						<ScanRowActions
							{rowLabel}
							canMerge={index > 0}
							canSplit={entry.receipts.length > 1}
							canRemove={true}
							onMerge={() => (entries = mergeRowWithPrevious(entries, index, rowAdapter))}
							onSplit={() => (entries = splitRowAt(entries, index, rowAdapter))}
							onRemove={() => (entries = entries.filter((item) => item.id !== entry.id))}
							disabled={isSubmitting}
						/>
					</div>

					<PaymentEntryFields
						idPrefix="{kind}-{entry.id}"
						value={entry}
						onChange={(changes) => updateEntry(entry.id, changes)}
						{lenderOptions}
						periodOptions={isReceived ? periodOptionsFor(entry.investorId) : null}
						dateLabel={isReceived ? 'Received date' : 'Sent date'}
						disabled={isSubmitting}
					>
						{#snippet afterLender()}
							{#if isReceived && entry.investorId}
								<div class="rounded-xl border border-border bg-background p-3">
									<p class="text-xs text-muted-foreground">Estimated remaining balance</p>
									<p class="mt-1 text-lg font-semibold">{formatCurrency(context.remaining)}</p>
								</div>
							{/if}
						{/snippet}
					</PaymentEntryFields>

					{#if !isReceived && context.usesInterestSchedule}
						<Alert.Root>
							<CalendarDays class="h-4 w-4" />
							<Alert.Description>
								This lender's existing interest schedule also applies to this principal amount.
							</Alert.Description>
						</Alert.Root>
					{/if}

					{#if !isReceived && !context.usesInterestSchedule}
						<div class="space-y-3">
							<Label>Interest</Label>
							<Tabs.Root
								value={entry.interestType}
								onValueChange={(interestType) =>
									interestType &&
									updateEntry(entry.id, { interestType: interestType as 'rate' | 'fixed' })}
							>
								<Tabs.List class="grid w-full grid-cols-2">
									<Tabs.Trigger value="rate">Rate (%)</Tabs.Trigger>
									<Tabs.Trigger value="fixed">Fixed (₱)</Tabs.Trigger>
								</Tabs.List>
							</Tabs.Root>
							<Input
								type="number"
								min="0"
								step="0.01"
								value={entry.interestValue}
								placeholder={entry.interestType === 'rate' ? '10' : '0.00'}
								disabled={isSubmitting}
								oninput={(event) =>
									updateEntry(entry.id, {
										interestValue: (event.currentTarget as HTMLInputElement).value
									})}
							/>
						</div>
					{/if}

					{#if !isReceived}
						<div class="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
							<Checkbox
								id="principal-sent-{entry.id}"
								checked={entry.isPaid}
								disabled={isSubmitting}
								onCheckedChange={(checked) => updateEntry(entry.id, { isPaid: checked === true })}
							/>
							<div>
								<Label for="principal-sent-{entry.id}">Funds have already been sent</Label>
								<p class="mt-0.5 text-xs text-muted-foreground">
									Leave unchecked to record a pending disbursement.
								</p>
							</div>
						</div>
					{/if}

					<ReceiptUploadField
						fieldId="receipt-{kind}-{entry.id}"
						idPrefix="{kind}-{entry.id}"
						receipts={entry.receipts}
						required
						error={receiptFieldError(entry)}
						showReading={!entry.scan}
						disabled={isSubmitting}
						scanContext={{
							...scanContext,
							investorIds: entry.investorId ? [Number(entry.investorId)] : undefined
						}}
						onChange={(receipts) => updateEntry(entry.id, { receipts })}
						onExtracted={(extracted) => handleReceiptExtracted(entry.id, extracted)}
						onSplitRequest={(scanned) => splitEntryFromScan(entry, scanned)}
					/>

					<ScanRowNotes scan={entry.scan} />
				</div>
			{/each}

			<Button
				type="button"
				variant="outline"
				class="w-full"
				disabled={isSubmitting}
				onclick={addBlankEntry}
			>
				<Plus class="mr-2 h-4 w-4" />
				{isReceived ? 'Add payment' : 'Add transfer'}
			</Button>

			<ReceiptIntake
				variant="compact"
				context={scanContext}
				{lenders}
				currentLoanId={loan.id}
				suggestPeriod={isReceived ? suggestPeriod : undefined}
				onCreate={addFromReceipts}
				disabled={isSubmitting}
			/>
		</form>
	</ResponsiveModal>
{/if}
