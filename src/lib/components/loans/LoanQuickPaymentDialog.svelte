<script lang="ts">
	import { ArrowDownToLine, ArrowUpFromLine, CalendarDays, Plus, Trash2 } from 'lucide-svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import * as Tabs from '$lib/components/ui/tabs';
	import { calculateTotalAmount } from '$lib/calculations';
	import { toLocalDateString } from '$lib/date-utils';
	import { formatCurrency, formatDate } from '$lib/format';
	import { toast } from '$lib/toast';
	import type { LoanWithInvestors } from '$lib/types';

	export type LoanQuickPaymentKind = 'payment' | 'received';

	interface PaymentEntry {
		id: string;
		investorId: string;
		amount: string;
		date: string;
		interestType: 'rate' | 'fixed';
		interestValue: string;
		isPaid: boolean;
		interestPeriodId: string;
	}

	interface Props {
		loan: LoanWithInvestors | null;
		kind: LoanQuickPaymentKind | null;
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSuccess?: () => void | Promise<void>;
	}

	let { loan, kind, open, onOpenChange, onSuccess }: Props = $props();

	function createPaymentEntry(defaultInvestorId = ''): PaymentEntry {
		return {
			id: crypto.randomUUID(),
			investorId: defaultInvestorId,
			amount: '',
			date: toLocalDateString(new Date()),
			interestType: 'rate',
			interestValue: '10',
			isPaid: true,
			interestPeriodId: 'general'
		};
	}

	const lenders = $derived.by(() => {
		if (!loan) return [];
		const unique = new Map(
			loan.loanInvestors.map((payment) => [payment.investor.id, payment.investor])
		);
		return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
	});

	let entries = $state<PaymentEntry[]>([createPaymentEntry()]);
	let isSubmitting = $state(false);

	$effect(() => {
		if (!open) return;
		entries = [createPaymentEntry(lenders.length === 1 ? String(lenders[0].id) : '')];
	});

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
			entries.every((entry) => {
				const context = getEntryContext(entry);
				return (
					Boolean(entry.investorId) &&
					Number.parseFloat(entry.amount) > 0 &&
					Boolean(entry.date) &&
					(isReceived ||
						context.usesInterestSchedule ||
						Number.parseFloat(entry.interestValue) >= 0)
				);
			})
	);

	const hasDuplicatePrincipalDates = $derived(
		!isReceived &&
			new Set(entries.map((entry) => `${entry.investorId}:${entry.date}`)).size !== entries.length
	);

	const unusedLenders = $derived.by(() => {
		const selectedLenderIds = new Set(entries.map((entry) => entry.investorId).filter(Boolean));
		return lenders.filter((lender) => !selectedLenderIds.has(String(lender.id)));
	});

	function updateEntry(id: string, changes: Partial<PaymentEntry>) {
		entries = entries.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry));
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!loan || !kind || !canSubmit || hasDuplicatePrincipalDates) {
			if (hasDuplicatePrincipalDates) {
				toast.error('The same lender cannot have two principal payments on the same date.');
			}
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
				const payload = isPeriodPayment
					? {
							status: 'Completed',
							receivedAmount: Number.parseFloat(entry.amount),
							receivedDate: entry.date
						}
					: isReceived
						? {
								investorId: context.selectedInvestorId,
								amount: entry.amount,
								receivedDate: entry.date,
								interestPeriodId: null
							}
						: {
								investorId: context.selectedInvestorId,
								amount: entry.amount,
								sentDate: entry.date,
								interestType: entry.interestType,
								interestValue: entry.interestValue,
								isPaid: entry.isPaid
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
				disabled={!canSubmit || hasDuplicatePrincipalDates || isSubmitting}
				onclick={() => {
					const form = document.getElementById('loan-quick-payment-form') as HTMLFormElement | null;
					form?.requestSubmit();
				}}
			>
				{isSubmitting
					? `Saving ${entries.length}...`
					: `${title}${entries.length > 1 ? `s (${entries.length})` : ''}`}
			</Button>
		{/snippet}
		<form id="loan-quick-payment-form" class="space-y-5" onsubmit={handleSubmit}>
				<div class="space-y-4">
					{#each entries as entry, index (entry.id)}
						{@const context = getEntryContext(entry)}
						<div class="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
							<div class="flex items-center justify-between gap-3">
								<p class="text-sm font-semibold">
									{isReceived ? 'Receipt' : 'Payment'}
									{index + 1}
								</p>
								{#if entries.length > 1}
									<Button
										type="button"
										variant="ghost"
										size="icon"
										class="h-8 w-8 text-muted-foreground hover:text-destructive"
										disabled={isSubmitting}
										aria-label={`Remove entry ${index + 1}`}
										onclick={() => {
											entries = entries.filter((item) => item.id !== entry.id);
										}}
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								{/if}
							</div>

							<div class="space-y-2">
								<Label for="{kind}-lender-{entry.id}">Lender</Label>
								<Select.Root
									type="single"
									value={entry.investorId}
									onValueChange={(investorId) =>
										investorId &&
										updateEntry(entry.id, { investorId, interestPeriodId: 'general' })}
									disabled={isSubmitting}
								>
									<Select.Trigger id="{kind}-lender-{entry.id}" class="w-full">
										{lenders.find((l) => String(l.id) === entry.investorId)?.name ??
											'Select a lender...'}
									</Select.Trigger>
									<Select.Content>
										{#each lenders as lender (lender.id)}
											<Select.Item value={String(lender.id)}>{lender.name}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>

							{#if isReceived && entry.investorId}
								<div class="rounded-xl border border-border bg-background p-3">
									<p class="text-xs text-muted-foreground">Estimated remaining balance</p>
									<p class="mt-1 text-lg font-semibold">{formatCurrency(context.remaining)}</p>
								</div>
							{/if}

							<div class="grid gap-4 sm:grid-cols-2">
								<div class="space-y-2">
									<Label for="{kind}-amount-{entry.id}">Amount</Label>
									<Input
										id="{kind}-amount-{entry.id}"
										type="number"
										min="0.01"
										step="0.01"
										value={entry.amount}
										placeholder="0.00"
										disabled={isSubmitting}
										oninput={(event) =>
											updateEntry(entry.id, {
												amount: (event.currentTarget as HTMLInputElement).value
											})}
									/>
								</div>
								<div class="space-y-2">
									<Label for="{kind}-date-{entry.id}">
										{isReceived ? 'Received date' : 'Sent date'}
									</Label>
									<Input
										id="{kind}-date-{entry.id}"
										type="date"
										value={entry.date}
										disabled={isSubmitting}
										oninput={(event) =>
											updateEntry(entry.id, {
												date: (event.currentTarget as HTMLInputElement).value
											})}
									/>
								</div>
							</div>

							{#if isReceived && context.periods.length}
								<div class="space-y-2">
									<Label for="received-period-{entry.id}">Apply payment to</Label>
									<Select.Root
										type="single"
										value={entry.interestPeriodId}
										onValueChange={(interestPeriodId) =>
											interestPeriodId && updateEntry(entry.id, { interestPeriodId })}
										disabled={isSubmitting}
									>
										<Select.Trigger id="received-period-{entry.id}" class="w-full">
											{entry.interestPeriodId === 'general'
												? 'General loan balance'
												: `Interest due ${formatDate(
														context.periods.find((p) => String(p.id) === entry.interestPeriodId)
															?.dueDate ?? ''
													)}`}
										</Select.Trigger>
										<Select.Content>
											<Select.Item value="general">General loan balance</Select.Item>
											{#each context.periods as period (period.id)}
												<Select.Item value={String(period.id)}>
													Interest due {formatDate(period.dueDate)}
												</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								</div>
							{/if}

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
								<div
									class="flex items-start gap-3 rounded-xl border border-border bg-background p-3"
								>
									<Checkbox
										id="principal-sent-{entry.id}"
										checked={entry.isPaid}
										disabled={isSubmitting}
										onCheckedChange={(checked) =>
											updateEntry(entry.id, { isPaid: checked === true })}
									/>
									<div>
										<Label for="principal-sent-{entry.id}">Funds have already been sent</Label>
										<p class="mt-0.5 text-xs text-muted-foreground">
											Leave unchecked to record a pending disbursement.
										</p>
									</div>
								</div>
							{/if}
						</div>
					{/each}

					{#if lenders.length > 1}
						<div class="grid gap-2 sm:grid-cols-2">
							<Button
								type="button"
								variant="outline"
								class="w-full"
								disabled={isSubmitting}
								onclick={() => {
									entries = [...entries, createPaymentEntry()];
								}}
							>
								<Plus class="mr-2 h-4 w-4" />
								Add another
							</Button>
							<Button
								type="button"
								variant="outline"
								class="w-full"
								disabled={isSubmitting || unusedLenders.length === 0}
								onclick={() => {
									const newEntries = unusedLenders.map((lender) =>
										createPaymentEntry(String(lender.id))
									);
									const hasOnlyBlankEntry =
										entries.length === 1 && !entries[0].investorId && !entries[0].amount;
									entries = hasOnlyBlankEntry ? newEntries : [...entries, ...newEntries];
								}}
							>
								Add all remaining lenders
							</Button>
						</div>
					{/if}
				</div>

			</form>
	</ResponsiveModal>
{/if}
