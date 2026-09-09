<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import {
		formatCurrency,
		formatPercentage,
		formatText,
		formatCount,
		formatDate
	} from '$lib/format';
	import { getLoanStatusBadge } from '$lib/badge-config';
	import type { LoanStatus } from '$lib/types';

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
		title = 'Summary'
	}: Props = $props();

	const rateDisplay = $derived(
		totalPrincipal > 0
			? formatPercentage(averageRate)
			: totalInterest > 0
				? formatText('Fixed')
				: formatPercentage(0)
	);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{title}</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-3">
		<div class="grid min-w-0 grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4">
			<div class="dashboard-metric-cell">
				<p class="text-caption mb-1">Total Principal</p>
				<p class="text-xs font-semibold break-all tabular-nums sm:text-sm">
					{formatCurrency(totalPrincipal)}
				</p>
			</div>
			<div class="dashboard-metric-cell">
				<p class="text-caption mb-1">Avg. Rate</p>
				<p class="text-xs font-semibold sm:text-sm">{rateDisplay}</p>
			</div>
			<div class="dashboard-metric-cell">
				<p class="text-caption mb-1">Total Interest</p>
				<p class="text-xs font-semibold break-all tabular-nums sm:text-sm">
					{formatCurrency(totalInterest)}
				</p>
			</div>
			<div class="dashboard-metric-cell">
				<p class="text-caption mb-1">Total Amount</p>
				<p class="text-xs font-semibold break-all tabular-nums sm:text-sm">
					{formatCurrency(totalAmount)}
				</p>
			</div>
			<div class="dashboard-metric-cell">
				<p class="text-caption mb-1">Received</p>
				<p class="text-xs font-semibold break-all tabular-nums sm:text-sm">
					{formatCurrency(totalReceived)}
				</p>
			</div>
			<div class="dashboard-metric-cell">
				<p class="text-caption mb-1">Balance</p>
				<p class="text-xs font-semibold break-all tabular-nums sm:text-sm">
					{formatCurrency(totalBalance)}
				</p>
			</div>
			<div class="dashboard-metric-cell">
				<p class="text-caption mb-1">Investors</p>
				<p class="text-xs font-semibold sm:text-sm">{formatCount(uniqueInvestors)}</p>
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
