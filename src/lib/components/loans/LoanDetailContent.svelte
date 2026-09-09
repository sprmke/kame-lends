<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import LoanSummarySection from './LoanSummarySection.svelte';
	import LoanInvestorsSection from './LoanInvestorsSection.svelte';
	import { formatDate, formatText, formatSqm } from '$lib/format';
	import { getLoanStatusBadge, getLoanTypeBadge } from '$lib/badge-config';
	import {
		calculateTotalPrincipal,
		calculateTotalInterest,
		calculateTotalAmount,
		calculateAverageRate,
		countUniqueInvestors,
		groupByInvestor,
		calculateLoanDuration
	} from '$lib/calculations';
	import type { LoanWithInvestors } from '$lib/types';

	interface Props {
		loan: LoanWithInvestors;
		showHeader?: boolean;
		onRefresh?: () => void | Promise<void>;
		loanId?: number;
		readOnly?: boolean;
		editableInvestorIds?: number[];
	}

	let {
		loan,
		showHeader = true,
		onRefresh,
		loanId,
		readOnly = false,
		editableInvestorIds = []
	}: Props = $props();

	const totalPrincipal = $derived(calculateTotalPrincipal(loan.loanInvestors));
	const totalInterest = $derived(calculateTotalInterest(loan.loanInvestors));
	const totalAmount = $derived(calculateTotalAmount(loan.loanInvestors));
	const averageRate = $derived(calculateAverageRate(loan.loanInvestors));
	const uniqueInvestors = $derived(countUniqueInvestors(loan.loanInvestors));

	const totalReceived = $derived(
		loan.loanInvestors.reduce(
			(sum, li) =>
				sum + (li.receivedPayments || []).reduce((t, rp) => t + (parseFloat(rp.amount) || 0), 0),
			0
		)
	);
	const totalBalance = $derived(totalAmount - totalReceived);

	const earliestSentDate = $derived(
		loan.loanInvestors.reduce(
			(earliest, li) => {
				const sentDate = new Date(li.sentDate);
				return !earliest || sentDate < earliest ? sentDate : earliest;
			},
			null as Date | null
		)
	);

	const duration = $derived(calculateLoanDuration(loan.dueDate, earliestSentDate || undefined));

	const fundedCapital = $derived(
		loan.loanInvestors.reduce(
			(sum, li) => (li.isPaid ? sum + (parseFloat(li.amount) || 0) : sum),
			0
		)
	);
	const balance = $derived(totalPrincipal - fundedCapital);

	const investorGroups = $derived(
		Array.from(groupByInvestor(loan.loanInvestors).values()).map((transactions) => {
			const transactionWithPeriods = transactions.find(
				(t) => t.interestPeriods && t.interestPeriods.length > 0
			);

			const receivedPayments = transactions.flatMap((li) =>
				(li.receivedPayments || []).map((rp) => ({
					id: rp.id,
					amount: rp.amount,
					interestPeriodId: rp.interestPeriodId ?? null,
					receivedDate:
						typeof rp.receivedDate === 'string'
							? rp.receivedDate
							: rp.receivedDate instanceof Date
								? rp.receivedDate.toISOString().slice(0, 10)
								: String(rp.receivedDate)
				}))
			);

			return {
				investor: transactions[0].investor,
				transactions,
				receivedPayments: receivedPayments.length > 0 ? receivedPayments : undefined,
				hasMultipleInterest: transactions[0].hasMultipleInterest || false,
				interestPeriods: transactionWithPeriods?.interestPeriods || []
			};
		})
	);
</script>

<div class="dashboard-stack">
	{#if showHeader}
		<div class="space-y-1">
			<h2 class="text-xl font-semibold tracking-tight">{formatText(loan.loanName)}</h2>
		</div>
	{/if}

	<LoanSummarySection
		{totalPrincipal}
		{averageRate}
		{totalInterest}
		{totalAmount}
		{totalReceived}
		{totalBalance}
		{uniqueInvestors}
		status={loan.status}
		{balance}
	/>

	<Card.Root>
		<Card.Header>
			<Card.Title>Loan Details</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-3">
			<div class="grid gap-3 sm:grid-cols-2">
				<div class="space-y-1">
					<p class="text-caption">Borrower</p>
					<p class="text-sm font-medium">{formatText(loan.borrower?.name ?? '-')}</p>
				</div>
				<div class="space-y-1">
					<p class="text-caption">Loan Name</p>
					<p class="text-sm font-medium">{formatText(loan.loanName)}</p>
				</div>
				<div class="space-y-1">
					<p class="text-caption">Type</p>
					<Badge
						variant={getLoanTypeBadge(loan.type).variant}
						class={getLoanTypeBadge(loan.type).className}
					>
						{formatText(loan.type)}
					</Badge>
				</div>
				<div class="space-y-1">
					<p class="text-caption">Due Date</p>
					<p class="text-sm font-medium">{formatDate(loan.dueDate)}</p>
				</div>
				<div class="space-y-1">
					<p class="text-caption">Status</p>
					<Badge
						variant={getLoanStatusBadge(loan.status).variant}
						class={getLoanStatusBadge(loan.status).className}
					>
						{formatText(loan.status)}
					</Badge>
				</div>
				<div class="space-y-1">
					<p class="text-caption">Free Lot (sqm)</p>
					<p class="text-sm font-medium">{loan.freeLotSqm ? formatSqm(loan.freeLotSqm) : '-'}</p>
				</div>
				<div class="space-y-1">
					<p class="text-caption">Duration</p>
					<p class="text-sm font-medium">{formatText(duration)}</p>
				</div>
			</div>
			<div class="space-y-1">
				<p class="text-caption">Notes</p>
				<p class="text-sm font-medium whitespace-pre-wrap">
					{loan.notes ? formatText(loan.notes) : '-'}
				</p>
			</div>
		</Card.Content>
	</Card.Root>

	<LoanInvestorsSection
		investorsWithTransactions={investorGroups}
		loanId={loanId ?? loan.id}
		{onRefresh}
	/>
</div>
