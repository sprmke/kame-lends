<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import DebtPaymentSchedule from '$lib/components/debts/DebtPaymentSchedule.svelte';
	import { formatCurrency } from '$lib/format';
	import {
		calculateDebtSummary,
		calculateDebtInterestOutstanding,
		calculateDebtPaymentsTotal,
		getIntervalLabel,
		normalizeDebtFees
	} from '$lib/debt-calculations';
	import type {
		DebtAdditionalFee,
		DebtInterestInterval,
		DebtInterestPeriodWithPayments
	} from '$lib/types';
	import { Calendar, TrendingUp } from 'lucide-svelte';
	import { ODD_LAST_TWO_COL_GRID_UNTIL_MD } from '$lib/summary-grid';
	import { cn } from '$lib/utils';

	interface Props {
		principal: string;
		interestRate: string;
		interestInterval: DebtInterestInterval;
		debtDate: string;
		durationMonths?: number;
		additionalFees: DebtAdditionalFee[];
		interestPeriods?: DebtInterestPeriodWithPayments[];
		onPaymentsChange?: () => void | Promise<void>;
	}

	let {
		principal,
		interestRate,
		interestInterval,
		debtDate,
		durationMonths = 12,
		additionalFees,
		interestPeriods,
		onPaymentsChange
	}: Props = $props();

	const principalNum = $derived(parseFloat(principal));
	const rateNum = $derived(parseFloat(interestRate));

	const isValid = $derived(principalNum > 0 && rateNum >= 0 && !!debtDate && durationMonths >= 1);

	const validFees = $derived(normalizeDebtFees(additionalFees));

	const summary = $derived(
		isValid
			? calculateDebtSummary({
					principal,
					interestRate,
					interestInterval,
					debtDate,
					durationMonths,
					additionalFees: validFees
				})
			: null
	);

	const intervalLabel = $derived(getIntervalLabel(interestInterval));
	const paymentsMade = $derived(calculateDebtPaymentsTotal(interestPeriods));
	const amountOutstanding = $derived(
		summary ? calculateDebtInterestOutstanding(summary.scheduledRepayment, interestPeriods) : 0
	);
</script>

{#if summary}
	<Card.Root class="border-primary/20 bg-primary/5">
		<Card.Header class="pb-3">
			<Card.Title class="flex items-center gap-2">
				<TrendingUp class="h-5 w-5 text-primary" />
				Interest Overview
			</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class={cn(ODD_LAST_TWO_COL_GRID_UNTIL_MD, 'grid grid-cols-2 gap-3 md:grid-cols-3')}>
				<div class="rounded-lg border bg-background p-3">
					<p class="mb-1 text-sm text-muted-foreground">Principal</p>
					<p class="text-base font-semibold">{formatCurrency(summary.principal)}</p>
				</div>
				<div class="rounded-lg border bg-background p-3">
					<p class="mb-1 text-sm text-muted-foreground">Payment per {intervalLabel}</p>
					<p class="text-base font-semibold">{formatCurrency(summary.perPeriodDue)}</p>
				</div>
				<div class="rounded-lg border bg-background p-3">
					<p class="mb-1 text-sm text-muted-foreground">Interest per {intervalLabel}</p>
					<p class="text-base font-semibold text-chart-2">
						{formatCurrency(summary.perPeriodInterest)}
					</p>
				</div>
				<div class="rounded-lg border bg-background p-3">
					<p class="mb-1 text-sm text-muted-foreground">Total interest</p>
					<p class="text-base font-semibold text-chart-2">
						{formatCurrency(summary.scheduleInterestTotal)}
					</p>
				</div>
				<div class="rounded-lg border bg-background p-3">
					<p class="mb-1 text-sm text-muted-foreground">Additional fees</p>
					<p class="text-base font-semibold">{formatCurrency(summary.additionalFeesTotal)}</p>
				</div>
				<div class="rounded-lg border bg-background p-3">
					<p class="mb-1 text-sm text-muted-foreground">Interest and fees</p>
					<p class="text-base font-semibold text-chart-2">
						{formatCurrency(summary.totalInterestIncludingFees)}
					</p>
				</div>
				<div class="rounded-lg border bg-background p-3">
					<p class="mb-1 text-sm text-muted-foreground">Total repayment</p>
					<p class="text-base font-semibold">{formatCurrency(summary.totalRepayment)}</p>
				</div>
				<div class="rounded-lg border bg-background p-3">
					<p class="mb-1 text-sm text-muted-foreground">Payments made</p>
					<p class="text-base font-semibold">{formatCurrency(paymentsMade)}</p>
				</div>
				<div class="rounded-lg border bg-background p-3">
					<p class="mb-1 text-sm text-muted-foreground">Amount outstanding</p>
					<p
						class="text-base font-semibold {amountOutstanding > 0
							? 'text-chart-5'
							: 'text-chart-2'}"
					>
						{formatCurrency(amountOutstanding)}
					</p>
				</div>
			</div>

			{#if validFees.length > 0}
				<div class="space-y-2">
					<p class="text-sm font-semibold text-muted-foreground">Fee breakdown</p>
					<div class="space-y-1.5">
						{#each validFees as fee, index (index)}
							<div
								class="flex items-center justify-between rounded border bg-background p-2.5 text-sm"
							>
								<span>{fee.label}</span>
								<span class="font-medium">{formatCurrency(parseFloat(fee.amount))}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if interestPeriods && interestPeriods.length > 0}
				<DebtPaymentSchedule schedule={summary.schedule} {interestPeriods} {onPaymentsChange} />
			{:else}
				<div class="space-y-2">
					<div class="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
						<Calendar class="h-4 w-4" />
						Payment schedule
					</div>
					<div class="max-h-80 space-y-1.5 overflow-y-auto pr-1">
						{#each summary.schedule as entry (entry.period)}
							<div
								class="flex items-start justify-between gap-3 rounded border bg-background p-3 text-sm"
							>
								<div class="flex min-w-0 items-center gap-2">
									<span class="w-7 shrink-0 text-muted-foreground">#{entry.period}</span>
									<span class="shrink-0">
										{entry.date.toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric'
										})}
									</span>
								</div>
								<div class="min-w-0 text-right text-sm leading-snug tabular-nums">
									<span class="text-base font-semibold">{formatCurrency(entry.periodDue)}</span>
									<span class="text-muted-foreground">
										·
										{formatCurrency(entry.principalPortion)} principal ·
									</span>
									<span class="text-chart-2">{formatCurrency(entry.interest)} interest</span>
									{#if entry.feesPortion > 0}
										<span class="text-muted-foreground">
											·
											{formatCurrency(entry.feesPortion)} fees
										</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
{/if}
