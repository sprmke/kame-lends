<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import {
		CalendarRange,
		Check,
		ChevronDown,
		Loader2,
		Pencil,
		Trash2
	} from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { formatCurrency, formatDate, formatRateLabel, formatText } from '$lib/format';
	import { calculateInterest } from '$lib/calculations';
	import { getInterestPeriodStatusBadge } from '$lib/badge-config';
	import ReceiptThumbnails from '$lib/components/common/ReceiptThumbnails.svelte';
	import type { InterestPeriodStatus } from '$lib/types';
	import {
		type InvestorMetrics,
		type InvestorTransactionDisplay,
		type ReceivedPaymentDisplay,
		formatCount,
		formatReceivedDatesCommaSeparated,
		sumLinkedPaymentsForPeriod
	} from './investor-transactions-helpers';

	interface Props {
		metrics: InvestorMetrics;
		transactions: InvestorTransactionDisplay[];
		loanTotalPrincipal: number;
		open: boolean;
		onOpenChange: (open: boolean) => void;
		showPeriodStatus: boolean;
		canMutate: boolean;
		loanId?: number;
		deletingPaymentIds: Set<number>;
		completingPeriods: Set<number | string>;
		editingPaymentPeriodIds: Set<number>;
		onDeletePayment: (paymentId: number) => void;
		onComplete: (
			periodId: number,
			periodInterest: number,
			amount: number
		) => void;
		onEditPayment: (
			periodId: number,
			periodInterest: number,
			linkedRows: ReceivedPaymentDisplay[]
		) => void;
	}

	let {
		metrics,
		transactions,
		loanTotalPrincipal,
		open,
		onOpenChange,
		showPeriodStatus,
		canMutate,
		loanId,
		deletingPaymentIds,
		completingPeriods,
		editingPaymentPeriodIds,
		onDeletePayment,
		onComplete,
		onEditPayment
	}: Props = $props();
</script>

{#if metrics.hasMultiplePeriods}
	<section
		class="overflow-hidden rounded-lg border border-border/70 bg-background shadow-none"
		aria-label="Interest periods"
	>
		<Collapsible.Root
			open={open}
			onOpenChange={onOpenChange}
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
						open && 'rotate-180'
					)}
				/>
			</Collapsible.Trigger>
			<Collapsible.Content>
				<div class="space-y-2.5 bg-muted/10 p-3">
					{#each metrics.sortedPeriodsForMatch as period, pIndex (period.id ?? `p-${pIndex}`)}
						{@const periodInterest =
							metrics.periodExpectedById.get(Number(period.id)) ??
							calculateInterest(
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
						{@const paidAllocated =
							pid != null ? (metrics.periodPaidById.get(pid) ?? paidLinked) : paidLinked}
						{@const unlinkedContribution = Math.max(0, paidAllocated - paidLinked)}
						{@const remainingDue = Math.max(0, periodInterest - paidAllocated)}
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
								: unlinkedContribution > 0
									? 'Unlinked'
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
											linkedRowsForPeriod.length > 0 ||
											unlinkedContribution > 0 ||
											legacyMatch
												? 'text-foreground'
												: 'text-muted-foreground'
										)}
									>
										{receivedDateLabel}
									</p>
								</div>
							</div>
							{#if paidAllocated > 0 || linkedRowsForPeriod.length > 0}
								<div class="mt-2 space-y-2 border-t border-border/50 pt-2">
									{#if paidAllocated > 0}
										<p class="text-[11px] text-muted-foreground">
											<span class="font-medium text-foreground tabular-nums">
												{formatCurrency(paidAllocated)}
											</span>
											paid ·
											<span class="font-medium text-foreground tabular-nums">
												{formatCurrency(remainingDue)}
											</span>
											remaining
											<span class="text-muted-foreground/90">
												(of {formatCurrency(periodInterest)} due for this period)
											</span>
											{#if unlinkedContribution > 0}
												<span class="text-muted-foreground/90">
													· {formatCurrency(unlinkedContribution)} from unlinked payments
												</span>
											{/if}
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
												<div class="space-y-1.5">
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
																onclick={() => onDeletePayment(rp.id!)}
															>
																{#if deletingPaymentIds.has(rp.id)}
																	<Loader2 class="h-3.5 w-3.5 animate-spin" />
																{:else}
																	<Trash2 class="h-3.5 w-3.5" />
																{/if}
															</Button>
														{/if}
													</div>
													<ReceiptThumbnails receipts={rp.receipts ?? []} />
													{#if rp.notes?.trim()}
														<p class="whitespace-pre-wrap px-1 text-xs text-muted-foreground">
															{formatText(rp.notes)}
														</p>
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
										onComplete(
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
										onEditPayment(pid, periodInterest, linkedRowsForPeriod)}
									disabled={editingPaymentPeriodIds.has(pid)}
									class="mt-2 h-7 w-full bg-background text-xs"
								>
									<Pencil class="mr-1.5 h-3 w-3" />
									{editingPaymentPeriodIds.has(pid) ? 'Saving…' : 'Edit payment'}
								</Button>
							{/if}
						</div>
					{/each}

					{#if metrics.unlinkedPayments.length > 0}
						<div class="mt-2 space-y-2 border-t border-border/50 pt-2">
							<p
								class="text-[11px] font-bold tracking-wider text-muted-foreground uppercase"
							>
								Unlinked payments
							</p>
							<p class="text-[11px] text-muted-foreground">
								Applied to the oldest open interest first, then principal.
							</p>
							{#each metrics.unlinkedPayments as rp, i (typeof rp.id === 'number' ? `unlinked-${rp.id}` : `unlinked-${i}`)}
								<div class="space-y-1.5">
									<div
										class="flex items-center gap-2 rounded-md border border-sky-200/70 bg-background px-2 py-1.5 text-xs dark:border-sky-900/45"
									>
										<div class="flex min-w-0 flex-1 justify-between gap-2">
											<span class="truncate text-muted-foreground">
												{formatDate(rp.receivedDate)}
											</span>
											<span class="shrink-0 font-semibold tabular-nums">
												{formatCurrency(parseFloat(rp.amount) || 0)}
											</span>
										</div>
										{#if canMutate && typeof rp.id === 'number' && loanId}
											<Button
												type="button"
												variant="ghost"
												size="icon"
												class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
												aria-label="Remove unlinked payment"
												disabled={deletingPaymentIds.has(rp.id)}
												onclick={() => onDeletePayment(rp.id!)}
											>
												{#if deletingPaymentIds.has(rp.id)}
													<Loader2 class="h-3.5 w-3.5 animate-spin" />
												{:else}
													<Trash2 class="h-3.5 w-3.5" />
												{/if}
											</Button>
										{/if}
									</div>
									<ReceiptThumbnails receipts={rp.receipts ?? []} />
									{#if rp.notes?.trim()}
										<p class="whitespace-pre-wrap px-1 text-xs text-muted-foreground">
											{formatText(rp.notes)}
										</p>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
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
			open={open}
			onOpenChange={onOpenChange}
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
						open && 'rotate-180'
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
									<div class="space-y-1.5">
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
										<ReceiptThumbnails receipts={rp.receipts ?? []} />
										{#if rp.notes?.trim()}
											<p class="whitespace-pre-wrap px-1 text-xs text-muted-foreground">
												{formatText(rp.notes)}
											</p>
										{/if}
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
