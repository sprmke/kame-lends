<script lang="ts">
	import { Calendar, FileText, Users } from 'lucide-svelte';
	import BrowserFrame from './BrowserFrame.svelte';

	const summary = [
		{ label: 'Principal', value: '₱250,000', icon: FileText },
		{ label: 'Investors', value: '2', icon: Users },
		{ label: 'Next due', value: 'Jun 28', icon: Calendar }
	];

	const periods = [
		{ period: 'May 2026', amount: '₱7,500', status: 'Paid' },
		{ period: 'Jun 2026', amount: '₱7,500', status: 'Due' }
	];
</script>

<BrowserFrame title="loans/42">
	<div class="space-y-4 p-4 sm:p-5">
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2">
					<h3 class="text-sm font-bold text-foreground">Mexico, Pampanga</h3>
					<span class="rounded-md bg-primary/12 px-2 py-0.5 text-[9px] font-semibold text-primary">
						Lot Title
					</span>
					<span class="rounded-md bg-chart-2/15 px-2 py-0.5 text-[9px] font-semibold text-chart-2">
						Active
					</span>
				</div>
				<p class="mt-1 text-[10px] text-muted-foreground">Due Jun 28, 2026 · Principal ₱250,000</p>
			</div>
		</div>

		<div class="grid grid-cols-3 gap-2">
			{#each summary as item (item.label)}
				<div class="rounded-xl border border-border/40 bg-card p-2.5">
					<item.icon class="mb-1.5 h-3.5 w-3.5 text-primary" />
					<p class="text-[9px] text-muted-foreground">{item.label}</p>
					<p class="text-[11px] font-bold tabular-nums">{item.value}</p>
				</div>
			{/each}
		</div>

		<div class="rounded-xl border border-border/50 bg-muted/20 p-3">
			<p class="text-[10px] font-semibold text-foreground">Interest periods</p>
			<div class="mt-2 space-y-1.5">
				{#each periods as row (row.period)}
					<div class="flex items-center justify-between rounded-lg bg-card px-2.5 py-2 text-[10px]">
						<span class="font-medium">{row.period}</span>
						<div class="flex items-center gap-2">
							<span class="font-semibold tabular-nums">{row.amount}</span>
							<span
								class={row.status === 'Paid'
									? 'rounded-md bg-chart-2/15 px-1.5 py-0.5 text-[9px] font-medium text-chart-2'
									: 'rounded-md bg-chart-5/15 px-1.5 py-0.5 text-[9px] font-medium text-chart-5'}
							>
								{row.status}
							</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</BrowserFrame>
