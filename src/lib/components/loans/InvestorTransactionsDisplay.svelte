<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import {
		Wallet,
		Check,
		Pencil,
		ArrowUpRight,
		ChevronDown,
		CalendarRange,
		Loader2,
		Trash2
	} from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { formatCurrency, formatDate, formatText, formatRateLabel } from '$lib/format';
	import { priceVisibility } from '$lib/stores/price-visibility.svelte';
	import { calculateInterest } from '$lib/calculations';
	import { getInterestPeriodStatusBadge } from '$lib/badge-config';
	import { toast } from '$lib/toast';
	import type { InterestPeriodStatus } from '$lib/types';
	import {
		type InvestorWithTransactions,
		computeLoanTotalPrincipal,
		computeInvestorMetrics,
		sectionKey,
		sumLinkedPaymentsForPeriod,
		formatReceivedDatesCommaSeparated,
		formatCount
	} from './investor-transactions-helpers';

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
	} | null>(null);

	let editPaymentModal = $state<{
		periodId: number;
		mode: 'single' | 'consolidate';
		paymentId: number | null;
		amount: string;
		receivedDate: string;
		expectedInterest: number;
	} | null>(null);

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
		const today = new Date().toISOString().slice(0, 10);
		const pay = Math.max(0, suggestedPaymentAmount);
		completeModal = {
			periodId,
			amount: pay.toFixed(2),
			receivedDate: today,
			expectedInterest: fullInterestForPeriod
		};
	}

	async function handleCompletePeriod() {
		if (!completeModal) return;
		const { periodId, amount, receivedDate } = completeModal;
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

		completingPeriods = new Set(completingPeriods).add(periodId);
		try {
			const response = await fetch(`/api/interest-periods/${periodId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					status: 'Completed',
					receivedAmount: parsed,
					receivedDate: trimmedDate
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
		linkedRows: { id?: number; amount: string; receivedDate: string }[]
	) {
		const today = new Date().toISOString().slice(0, 10);
		if (linkedRows.length === 0) {
			editPaymentModal = {
				periodId,
				mode: 'consolidate',
				paymentId: null,
				amount: periodInterest.toFixed(2),
				receivedDate: today,
				expectedInterest: periodInterest
			};
			return;
		}
		const sum = linkedRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
		const last = linkedRows[linkedRows.length - 1];
		const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(last.receivedDate)
			? last.receivedDate
			: new Date(last.receivedDate).toISOString().slice(0, 10);
		const single = linkedRows.length === 1 && typeof linkedRows[0].id === 'number';
		editPaymentModal = {
			periodId,
			mode: single ? 'single' : 'consolidate',
			paymentId: single ? linkedRows[0].id! : null,
			amount: sum.toFixed(2),
			receivedDate: dateStr,
			expectedInterest: periodInterest
		};
	}

	async function handleEditPaymentSave() {
		if (!editPaymentModal) return;
		const { periodId, mode, paymentId, amount, receivedDate } = editPaymentModal;
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

		editingPaymentPeriodIds = new Set(editingPaymentPeriodIds).add(periodId);
		try {
			if (mode === 'single' && paymentId != null) {
				const response = await fetch(`/api/received-payments/${paymentId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ amount: parsed, receivedDate: trimmedDate })
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
					body: JSON.stringify({ amount: parsed, receivedDate: trimmedDate })
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

	async function handleDeleteReceivedPayment(paymentId: number) {
		if (!window.confirm('Remove this payment record? You can add it again with Record payment.')) {
			return;
		}
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
				<section
					class="overflow-hidden rounded-lg border border-border/70 bg-background shadow-none"
					aria-label="Principal disbursements"
				>
					<Collapsible.Root
						open={principalOpen}
						onOpenChange={(open) => setSectionOpen(investor.id, 'principal', open)}
					>
						<Collapsible.Trigger
							class="flex w-full items-center gap-2.5 border-b border-border/50 bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
						>
							<div
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
							>
								<ArrowUpRight class="h-5 w-5" />
							</div>
							<div class="min-w-0 flex-1">
								<p class="mt-0.5 text-sm font-semibold">Disbursements</p>
								<p class="mt-0.5 text-xs text-muted-foreground">
									{metrics.principalCount === 1
										? `${formatCount(1)} payment`
										: `${formatCount(metrics.principalCount)} payments`} · Total {formatCurrency(
										metrics.totalCapital
									)}
								</p>
							</div>
							<ChevronDown
								class={cn(
									'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
									principalOpen && 'rotate-180'
								)}
							/>
						</Collapsible.Trigger>
						<Collapsible.Content>
							<div class="space-y-2.5 bg-muted/10 p-3">
								{#each transactions as transaction, index (transaction.id ?? `t-${index}`)}
									{@const capital = parseFloat(transaction.amount) || 0}
									{@const isUnpaid = !transaction.isPaid}
									<div
										class={cn(
											'rounded-lg border border-border/60 bg-card p-3 shadow-sm',
											isUnpaid &&
												'border-amber-300/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/25'
										)}
									>
										<div class="flex items-center justify-between gap-3">
											<div class="flex min-w-0 items-center gap-2.5">
												<ArrowUpRight class="h-4 w-4 shrink-0 text-muted-foreground" />
												<div class="min-w-0">
													<p class="text-[11px] font-medium text-muted-foreground">Sent date</p>
													<p class="mt-0.5 text-sm font-semibold">
														{formatDate(transaction.sentDate)}
													</p>
												</div>
											</div>
											<div class="flex shrink-0 items-center gap-2">
												{#if isUnpaid}
													<Badge
														class="h-4 border-amber-200 bg-amber-100 px-1.5 py-0 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
													>
														Pending
													</Badge>
												{/if}
												<p class="text-sm font-bold tabular-nums">{formatCurrency(capital)}</p>
											</div>
										</div>
										{#if canMutate && isUnpaid && loanId && typeof transaction.id === 'number'}
											<Button
												size="sm"
												onclick={() => handlePayTransaction(transaction.id!)}
												disabled={payingTransactions.has(transaction.id!)}
												class="mt-3 h-8 w-full bg-yellow-500 text-xs text-white hover:bg-yellow-600"
											>
												<Wallet class="mr-1.5 h-3 w-3" />
												{payingTransactions.has(transaction.id!) ? 'Paying…' : 'Mark as Paid'}
											</Button>
										{/if}
									</div>
								{/each}
							</div>
						</Collapsible.Content>
					</Collapsible.Root>
				</section>

				{#if metrics.hasMultiplePeriods}
					<section
						class="overflow-hidden rounded-lg border border-border/70 bg-background shadow-none"
						aria-label="Interest periods"
					>
						<Collapsible.Root
							open={interestOpen}
							onOpenChange={(open) => setSectionOpen(investor.id, 'interest', open)}
						>
							<Collapsible.Trigger
								class="flex w-full items-center gap-2.5 border-b border-border/50 bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
							>
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
								>
									<CalendarRange class="h-5 w-5" />
								</div>
								<div class="min-w-0 flex-1">
									<p class="mt-0.5 text-sm font-semibold">Interest periods</p>
									<p class="mt-0.5 text-xs text-muted-foreground">
										{formatCount(metrics.periodCount)} scheduled · {formatCurrency(
											metrics.totalInterest
										)} interest{metrics.receivedCount > 0
											? ` · ${formatCurrency(metrics.totalReceived)} received`
											: ''}
									</p>
								</div>
								<ChevronDown
									class={cn(
										'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
										interestOpen && 'rotate-180'
									)}
								/>
							</Collapsible.Trigger>
							<Collapsible.Content>
								<div class="space-y-2.5 bg-muted/10 p-3">
									{#each metrics.sortedPeriodsForMatch as period, pIndex (period.id ?? `p-${pIndex}`)}
										{@const periodInterest = calculateInterest(
											metrics.periodPrincipalBase,
											period.interestRate,
											period.interestType
										)}
										{@const periodRate =
											period.interestType === 'fixed'
												? metrics.periodPrincipalBase > 0
													? (periodInterest / metrics.periodPrincipalBase) * 100
													: 0
												: parseFloat(period.interestRate) || 0}
										{@const periodStatus = (period.status || 'Pending') as InterestPeriodStatus}
										{@const statusBadge = getInterestPeriodStatusBadge(periodStatus)}
										{@const pid = typeof period.id === 'number' ? period.id : null}
										{@const paidLinked =
											pid != null ? sumLinkedPaymentsForPeriod(metrics.receivedPayments, pid) : 0}
										{@const remainingDue = Math.max(0, periodInterest - paidLinked)}
										{@const linkedRowsForPeriod =
											pid != null
												? [...metrics.receivedPayments]
														.filter((rp) => rp.interestPeriodId === pid)
														.sort(
															(a, b) =>
																new Date(a.receivedDate).getTime() -
																new Date(b.receivedDate).getTime()
														)
												: []}
										{@const canComplete =
											pid != null &&
											(periodStatus === 'Pending' ||
												periodStatus === 'Overdue' ||
												periodStatus === 'Incomplete') &&
											!!loanId}
										{@const canEditPayment =
											pid != null && periodStatus === 'Completed' && !!loanId}
										{@const legacyMatch =
											pid != null ? metrics.periodReceivedDateById.get(pid) : undefined}
										{@const receivedDateLabel =
											linkedRowsForPeriod.length > 0
												? formatReceivedDatesCommaSeparated(linkedRowsForPeriod)
												: periodStatus === 'Completed' || periodStatus === 'Incomplete'
													? legacyMatch
														? formatDate(legacyMatch)
														: '—'
													: '—'}
										<div class="rounded-lg border border-border/60 bg-card px-3 py-3 shadow-sm">
											<div class="mb-1.5 flex items-center justify-between">
												<span class="text-xs font-semibold text-muted-foreground">
													{pIndex === metrics.sortedPeriodsForMatch.length - 1
														? `Period ${pIndex + 1} · Final`
														: `Period ${pIndex + 1}`}
												</span>
												{#if showPeriodStatus}
													<Badge
														variant={statusBadge.variant}
														class="h-4 text-[10px] {statusBadge.className || ''}"
													>
														{periodStatus}
													</Badge>
												{/if}
											</div>
											<div
												class="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4 sm:gap-x-4"
											>
												<div>
													<p class="text-[11px] text-muted-foreground">Due date</p>
													<p class="font-medium">{formatDate(period.dueDate)}</p>
												</div>
												<div>
													<p class="text-[11px] text-muted-foreground">Rate</p>
													<p class="font-medium">
														{formatRateLabel(periodRate, {
															fixed: period.interestType === 'fixed'
														})}
													</p>
												</div>
												<div>
													<p class="text-[11px] text-muted-foreground">Interest</p>
													<p class="font-semibold tabular-nums">
														{formatCurrency(periodInterest)}
													</p>
												</div>
												<div>
													<p class="text-[11px] text-muted-foreground">Received date</p>
													<p
														class={cn(
															'font-medium text-balance tabular-nums',
															linkedRowsForPeriod.length > 0 || legacyMatch
																? 'text-foreground'
																: 'text-muted-foreground'
														)}
													>
														{receivedDateLabel}
													</p>
												</div>
											</div>
											{#if periodStatus !== 'Completed' || linkedRowsForPeriod.length > 1}
												<div class="mt-2 space-y-2 border-t border-border/50 pt-2">
													{#if paidLinked > 0}
														<p class="text-[11px] text-muted-foreground">
															<span class="font-medium text-foreground tabular-nums">
																{formatCurrency(paidLinked)}
															</span>
															paid ·
															<span class="font-medium text-foreground tabular-nums">
																{formatCurrency(remainingDue)}
															</span>
															remaining
															<span class="text-muted-foreground/90">
																(of {formatCurrency(periodInterest)} due for this period)
															</span>
														</p>
													{/if}
													{#if linkedRowsForPeriod.length > 0}
														<div class="space-y-1.5">
															<p
																class="text-[11px] font-bold tracking-wider text-muted-foreground uppercase"
															>
																Payments recorded
															</p>
															{#each linkedRowsForPeriod as rp, i (typeof rp.id === 'number' ? `rp-${rp.id}` : `rp-${pid}-${i}`)}
																<div
																	class="flex items-center gap-2 rounded-md border border-emerald-200/70 bg-background px-2 py-1.5 text-xs dark:border-emerald-900/45"
																>
																	<div class="flex min-w-0 flex-1 justify-between gap-2">
																		<span class="truncate text-muted-foreground">
																			{formatDate(rp.receivedDate)}
																		</span>
																		<span
																			class="shrink-0 font-semibold text-emerald-700 tabular-nums dark:text-emerald-400"
																		>
																			{formatCurrency(parseFloat(rp.amount) || 0)}
																		</span>
																	</div>
																	{#if canMutate && typeof rp.id === 'number' && loanId}
																		<Button
																			type="button"
																			variant="ghost"
																			size="icon"
																			class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
																			aria-label="Remove payment"
																			disabled={deletingPaymentIds.has(rp.id)}
																			onclick={() => handleDeleteReceivedPayment(rp.id!)}
																		>
																			{#if deletingPaymentIds.has(rp.id)}
																				<Loader2 class="h-3.5 w-3.5 animate-spin" />
																			{:else}
																				<Trash2 class="h-3.5 w-3.5" />
																			{/if}
																		</Button>
																	{/if}
																</div>
															{/each}
														</div>
													{/if}
												</div>
											{/if}
											{#if canComplete && pid != null}
												<Button
													size="sm"
													variant="outline"
													onclick={() =>
														openCompleteModal(
															pid,
															periodInterest,
															remainingDue > 0 ? remainingDue : periodInterest
														)}
													disabled={completingPeriods.has(period.id!)}
													class="mt-2 h-7 w-full bg-background text-xs"
												>
													{#if periodStatus === 'Incomplete'}
														<Pencil class="mr-1.5 h-3 w-3" />
													{:else}
														<Check class="mr-1.5 h-3 w-3" />
													{/if}
													{completingPeriods.has(period.id!)
														? 'Recording…'
														: periodStatus === 'Incomplete'
															? 'More payment'
															: 'Pay'}
												</Button>
											{/if}
											{#if canEditPayment && pid != null}
												<Button
													size="sm"
													variant="outline"
													onclick={() =>
														openEditPaymentModal(pid, periodInterest, linkedRowsForPeriod)}
													disabled={editingPaymentPeriodIds.has(pid)}
													class="mt-2 h-7 w-full bg-background text-xs"
												>
													<Pencil class="mr-1.5 h-3 w-3" />
													{editingPaymentPeriodIds.has(pid) ? 'Saving…' : 'Edit payment'}
												</Button>
											{/if}
										</div>
									{/each}
								</div>
							</Collapsible.Content>
						</Collapsible.Root>
					</section>
				{:else}
					<section
						class="overflow-hidden rounded-lg border border-border/70 bg-background shadow-none"
						aria-label="Interest terms"
					>
						<Collapsible.Root
							open={interestOpen}
							onOpenChange={(open) => setSectionOpen(investor.id, 'interest', open)}
						>
							<Collapsible.Trigger
								class="flex w-full items-center gap-2.5 border-b border-border/50 bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
							>
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
								>
									<CalendarRange class="h-5 w-5" />
								</div>
								<div class="min-w-0 flex-1">
									<p class="mt-0.5 text-sm font-semibold">Single repayment</p>
									<p class="mt-0.5 text-xs text-muted-foreground">
										{formatCurrency(metrics.totalInterest)} interest{metrics.receivedCount > 0
											? ` · ${formatCurrency(metrics.totalReceived)} received`
											: ''}
									</p>
								</div>
								<ChevronDown
									class={cn(
										'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
										interestOpen && 'rotate-180'
									)}
								/>
							</Collapsible.Trigger>
							<Collapsible.Content>
								<div class="space-y-2.5 bg-muted/10 p-3">
									<div
										class="space-y-2.5 rounded-md border bg-violet-500/3 p-3 dark:bg-violet-950/20"
									>
										<div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
											<div>
												<p class="text-[11px] font-medium text-muted-foreground">Avg. rate</p>
												<p class="mt-0.5 font-semibold">{metrics.rateDisplay}</p>
											</div>
											<div>
												<p class="text-[11px] font-medium text-muted-foreground">Total interest</p>
												<p class="mt-0.5 font-bold tabular-nums">
													{formatCurrency(metrics.totalInterest)}
												</p>
											</div>
											<div class="col-span-2 sm:col-span-1">
												<p class="text-[11px] font-medium text-muted-foreground">Principal base</p>
												<p class="mt-0.5 font-semibold tabular-nums">
													{formatCurrency(metrics.totalCapital)}
												</p>
											</div>
										</div>
										{#if transactions.length > 1}
											<div class="space-y-2 border-t border-border/40 pt-3">
												<p
													class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
												>
													By disbursement
												</p>
												{#each transactions as t, idx (t.id ?? `si-${idx}`)}
													{@const cap = parseFloat(t.amount) || 0}
													{@const int = calculateInterest(
														cap === 0 ? loanTotalPrincipal : cap,
														t.interestRate,
														t.interestType
													)}
													<div
														class="flex justify-between gap-2 rounded-md border bg-background px-2 py-1.5 text-xs"
													>
														<span class="truncate text-muted-foreground">
															{formatDate(t.sentDate)}
														</span>
														<span class="shrink-0 font-semibold tabular-nums">
															{formatCurrency(int)}
														</span>
													</div>
												{/each}
											</div>
										{/if}
										{#if metrics.receivedCount > 0}
											<div class="space-y-2 border-t border-border/40 pt-3">
												<p
													class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
												>
													Payments received
												</p>
												{#each metrics.receivedPayments as rp, idx (`single-rp-${idx}`)}
													<div
														class="flex justify-between gap-2 rounded-md border border-emerald-200/60 bg-background px-2 py-1.5 text-xs dark:border-emerald-900/40"
													>
														<span class="text-muted-foreground">
															{formatDate(rp.receivedDate)}
														</span>
														<span
															class="shrink-0 font-semibold text-emerald-700 tabular-nums dark:text-emerald-400"
														>
															{formatCurrency(parseFloat(rp.amount) || 0)}
														</span>
													</div>
												{/each}
											</div>
										{/if}
									</div>
								</div>
							</Collapsible.Content>
						</Collapsible.Root>
					</section>
				{/if}
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
						<p class="text-muted-foreground">Avg. Rate</p>
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
				<p class="text-[11px] text-muted-foreground">
					Max for this period: {formatCurrency(editPaymentModal.expectedInterest)}
				</p>
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
		</div>
	{/if}
</ResponsiveModal>
