<script lang="ts">
	import { ArrowDownLeft, ArrowUpRight } from 'lucide-svelte';
	import BrowserFrame from './BrowserFrame.svelte';

	const txs = [
		{
			label: 'Collection — Maria Santos',
			amount: '+₱12,500',
			type: 'in' as const,
			date: 'May 26'
		},
		{
			label: 'Disbursement — Juan Dela Cruz',
			amount: '-₱180,000',
			type: 'out' as const,
			date: 'May 25'
		},
		{
			label: 'Investor Return — Roberto Lim',
			amount: '-₱8,400',
			type: 'out' as const,
			date: 'May 24'
		},
		{
			label: 'Collection — Ana Reyes',
			amount: '+₱4,750',
			type: 'in' as const,
			date: 'May 23'
		}
	];
</script>

<BrowserFrame title="transactions">
	<div class="space-y-3 p-4 sm:p-5">
		<div>
			<p class="text-[10px] font-semibold tracking-wider text-primary uppercase">Ledger</p>
			<h3 class="text-sm font-bold">Transactions</h3>
		</div>
		<div class="space-y-1.5">
			{#each txs as tx (tx.label)}
				<div
					class="flex items-center gap-2.5 rounded-xl border border-border/40 bg-card px-3 py-2.5"
				>
					<div
						class={tx.type === 'in'
							? 'flex h-7 w-7 items-center justify-center rounded-lg bg-chart-2/15 text-chart-2'
							: 'flex h-7 w-7 items-center justify-center rounded-lg bg-chart-3/15 text-chart-3'}
					>
						{#if tx.type === 'in'}
							<ArrowDownLeft class="h-3.5 w-3.5" />
						{:else}
							<ArrowUpRight class="h-3.5 w-3.5" />
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-[10px] font-medium">{tx.label}</p>
						<p class="text-[9px] text-muted-foreground">{tx.date}</p>
					</div>
					<p
						class="text-[10px] font-bold tabular-nums {tx.type === 'in'
							? 'text-chart-2'
							: 'text-foreground'}"
					>
						{tx.amount}
					</p>
				</div>
			{/each}
		</div>
	</div>
</BrowserFrame>
