<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import GridListCardShell from '$lib/components/common/GridListCardShell.svelte';
	import { createRowActionItems } from '$lib/components/common/action-buttons';
	import { formatCurrency, formatDateShort, formatText } from '$lib/format';
	import { calculateDebtSummary, calculatePerPeriodInterest } from '$lib/debt-calculations';
	import type { DebtWithInvestor } from '$lib/types';

	interface Props {
		debt: DebtWithInvestor;
		viewHref?: string;
		onQuickView?: (debt: DebtWithInvestor) => void;
		onEdit?: (debt: DebtWithInvestor) => void;
		onDelete?: (debt: DebtWithInvestor) => void;
	}

	let {
		debt,
		viewHref = `/debts/${debt.id}`,
		onQuickView,
		onEdit,
		onDelete
	}: Props = $props();

	const actionItems = $derived(
		createRowActionItems({
			onEdit: onEdit ? () => onEdit(debt) : undefined,
			onDelete: onDelete ? () => onDelete(debt) : undefined
		})
	);

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

<GridListCardShell
	{viewHref}
	{actionItems}
	onQuickView={onQuickView ? () => onQuickView(debt) : undefined}
>
	{#snippet header()}
		<div class="flex items-start justify-between gap-2 max-lg:pr-0">
			<Card.Title class="mb-2 min-w-0 flex-1 truncate text-sm sm:text-base">
				{formatText(debt.name)}
			</Card.Title>
			<Badge variant="secondary" class="shrink-0 text-[10px]">{debt.interestInterval}</Badge>
		</div>
	{/snippet}
	{#snippet children()}
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
				<p class="text-xs font-semibold text-chart-2">{formatCurrency(perPeriodInterest)}</p>
			</div>
			<div class="dashboard-metric-cell p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Total Interest</p>
				<p class="text-xs font-semibold text-chart-2">{formatCurrency(totalInterest)}</p>
			</div>
		</div>
		<p class="truncate text-xs text-muted-foreground">{formatText(debt.investor.name)}</p>
	{/snippet}
</GridListCardShell>
