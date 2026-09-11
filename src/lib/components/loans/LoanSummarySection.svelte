<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import {
		formatCurrency,
		formatPercentage,
		formatText,
		formatCount
	} from '$lib/format';
	import { getLoanStatusBadge } from '$lib/badge-config';
	import type { LoanStatus } from '$lib/types';
	import { ODD_LAST_TWO_COL_GRID } from '$lib/summary-grid';
	import { cn } from '$lib/utils';

	interface Props {
		totalPrincipal: number;
		averageRate: number;
		totalInterest: number;
		totalAmount: number;
		totalReceived?: number;
		totalBalance?: number;
		uniqueInvestors: number;
		status?: LoanStatus;
		balance?: number;
		title?: string;
		profit?: number;
		profitRate?: number;
		profitType?: 'rate' | 'fixed';
	}

	let {
		totalPrincipal,
		averageRate,
		totalInterest,
		totalAmount,
		totalReceived = 0,
		totalBalance = 0,
		uniqueInvestors,
		status,
		balance,
		title = 'Summary',
		profit,
		profitRate,
		profitType
	}: Props = $props();

	const rateDisplay = $derived(
		totalPrincipal > 0
			? formatPercentage(averageRate)
			: totalInterest > 0
				? formatText('Fixed')
				: formatPercentage(0)
	);

	const profitRateDisplay = $derived(
		profitType === 'fixed' ? formatText('Fixed') : formatPercentage(profitRate ?? 0)
	);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{title}</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		<div class={cn(ODD_LAST_TWO_COL_GRID, 'grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-4')}>
			<div class="dashboard-metric-cell">
				<p class="text-caption mb-1">Total Principal</p>
				<p class="text-sm font-semibold break-all tabular-nums">
					{formatCurrency(totalPrincipal)}
				</p>
			</div>
			<div class="dashboard-metric-cell">
				<p class="text-caption mb-1">Avg. Rate</p>
				<p class="text-sm font-semibold">{rateDisplay}</p>
			</div>
			<div class="dashboard-metric-cell">
				<p class="text-caption mb-1">Total Interest</p>
				<p class="text-sm font-semibold break-all tabular-nums">
					{formatCurrency(totalInterest)}
				</p>
			</div>
			<div class="dashboard-metric-cell">
				<p class="text-caption mb-1">Total Amount</p>
				<p class="text-sm font-semibold break-all tabular-nums">
					{formatCurrency(totalAmount)}
				</p>
			</div>
			{#if profit !== undefined}
				<div class="dashboard-metric-cell">
					<p class="text-caption mb-1">Profit Rate</p>
					<p class="text-sm font-semibold">{profitRateDisplay}</p>
				</div>
				<div class="dashboard-metric-cell">
					<p class="text-caption mb-1">Profit</p>
					<p class="text-sm font-semibold break-all tabular-nums">
						{formatCurrency(profit)}
					</p>
				</div>
			{/if}
			<div class="dashboard-metric-cell">
				<p class="text-caption mb-1">Total Received</p>
				<p class="text-sm font-semibold break-all tabular-nums">
					{formatCurrency(totalReceived)}
				</p>
			</div>
			<div class="dashboard-metric-cell">
				<p class="text-caption mb-1">Total Balance</p>
				<p class="text-sm font-semibold break-all tabular-nums">
					{formatCurrency(totalBalance)}
				</p>
			</div>
			<div class="dashboard-metric-cell">
				<p class="text-caption mb-1">Investors</p>
				<p class="text-sm font-semibold">{formatCount(uniqueInvestors)}</p>
			</div>
			{#if status}
				<div class="dashboard-metric-cell">
					<p class="text-caption mb-1">Status</p>
					<Badge
						variant={getLoanStatusBadge(status).variant}
						class="{getLoanStatusBadge(status)
							.className} h-auto max-w-full py-1 text-[11px] leading-tight !whitespace-normal"
					>
						{formatText(status)}
					</Badge>
				</div>
			{/if}
			{#if balance !== undefined && balance > 0}
				<div class="dashboard-metric-cell">
					<p class="text-caption mb-1">Unfunded</p>
					<p class="text-xs font-semibold break-all tabular-nums sm:text-sm">
						{formatCurrency(balance)}
					</p>
				</div>
			{/if}
		</div>
	</Card.Content>
</Card.Root>
