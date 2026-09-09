<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import ActionButtons from '$lib/components/common/ActionButtons.svelte';
	import { formatCurrency, formatDateShort, formatText } from '$lib/format';
	import { calculateDebtSummary, calculatePerPeriodInterest } from '$lib/debt-calculations';
	import type { DebtWithInvestor } from '$lib/types';

	interface Props {
		debt: DebtWithInvestor;
		viewHref?: string;
		onQuickView?: (debt: DebtWithInvestor) => void;
	}

	let { debt, viewHref = `/debts/${debt.id}`, onQuickView }: Props = $props();

	const perPeriodInterest = $derived(calculatePerPeriodInterest(debt.amount, debt.interestRate));
	const debtDate = $derived(
		debt.date instanceof Date
			? debt.date.toISOString().split('T')[0]
			: String(debt.date).split('T')[0]
	);
	const totalInterest = $derived(
		calculateDebtSummary({
			principal: debt.amount,
			interestRate: debt.interestRate,
			interestInterval: debt.interestInterval,
			debtDate,
			durationMonths: debt.durationMonths,
			additionalFees: debt.additionalFees ?? []
		}).totalInterestIncludingFees
	);
</script>

<Card.Root class="flex h-full flex-col overflow-hidden transition-colors hover:border-primary/20">
	<Card.Header class="px-3 pt-3 pb-0">
		<div class="flex items-start justify-between gap-2">
			<Card.Title class="mb-2 truncate text-sm sm:text-base">{formatText(debt.name)}</Card.Title>
			<Badge variant="secondary" class="shrink-0 text-[10px]">{debt.interestInterval}</Badge>
		</div>
	</Card.Header>
	<Card.Content class="flex-1 space-y-2 px-3 pt-0 pb-2.5">
		<div class="grid grid-cols-2 gap-1.5">
			<div class="dashboard-metric-cell p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Start Date</p>
				<p class="text-xs font-medium">{formatDateShort(debt.date)}</p>
			</div>
			<div class="dashboard-metric-cell p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Principal</p>
				<p class="text-xs font-semibold">{formatCurrency(debt.amount)}</p>
			</div>
			<div class="dashboard-metric-cell p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Interest / Period</p>
				<p class="text-xs font-semibold text-emerald-600">{formatCurrency(perPeriodInterest)}</p>
			</div>
			<div class="dashboard-metric-cell p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Total Interest</p>
				<p class="text-xs font-semibold text-emerald-600">{formatCurrency(totalInterest)}</p>
			</div>
		</div>
		<p class="truncate text-xs text-muted-foreground">{formatText(debt.investor.name)}</p>
	</Card.Content>
	<Card.Footer class="border-t px-0 py-0">
		<ActionButtons
			{viewHref}
			showView={false}
			size="md"
			onQuickView={onQuickView
				? (event) => {
						event.preventDefault();
						event.stopPropagation();
						onQuickView(debt);
					}
				: undefined}
		/>
	</Card.Footer>
</Card.Root>
