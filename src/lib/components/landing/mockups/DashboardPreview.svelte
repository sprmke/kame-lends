<script lang="ts">
	import { Activity, CheckCircle2, CircleDollarSign, TrendingUp, Wallet } from 'lucide-svelte';
	import BrowserFrame from './BrowserFrame.svelte';

	interface Props {
		glow?: boolean;
	}

	let { glow = true }: Props = $props();

	const metrics = [
		{
			label: 'Total Principal',
			value: '₱4,850,000',
			icon: Wallet,
			accent: 'bg-primary/12 text-primary'
		},
		{
			label: 'Active Loans',
			value: '127',
			icon: Activity,
			accent: 'bg-chart-5/15 text-chart-5'
		},
		{
			label: 'Collected',
			value: '₱892,400',
			icon: CheckCircle2,
			accent: 'bg-chart-4/12 text-chart-4'
		},
		{
			label: 'Interest Due',
			value: '₱156,200',
			icon: TrendingUp,
			accent: 'bg-chart-2/12 text-chart-2'
		},
		{
			label: 'Investors',
			value: '24',
			icon: CircleDollarSign,
			accent: 'bg-chart-1/12 text-chart-1'
		}
	];

	const cashflowBars = [40, 65, 45, 80, 55, 90, 70];
	const activity = [
		{ label: 'Past Due', count: 3 },
		{ label: 'Maturing', count: 8 },
		{ label: 'Pending', count: 2 }
	];
</script>

<BrowserFrame title="dashboard" {glow}>
	<div class="space-y-4 p-4 sm:p-5">
		<div class="min-w-0">
			<p class="text-[10px] font-semibold tracking-wider text-primary uppercase">Overview</p>
			<h3 class="text-sm font-bold text-foreground">Dashboard</h3>
			<p class="mt-0.5 text-[10px] text-muted-foreground">Your lending portfolio at a glance</p>
		</div>

		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
			{#each metrics.slice(0, 3) as m (m.label)}
				<div class="min-w-0 rounded-xl border border-border/40 bg-card p-2.5 shadow-sm">
					<div class="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg {m.accent}">
						<m.icon class="h-3.5 w-3.5" />
					</div>
					<p class="truncate text-[9px] text-muted-foreground">{m.label}</p>
					<p class="truncate text-xs font-bold tabular-nums">{m.value}</p>
				</div>
			{/each}
		</div>

		<div class="grid grid-cols-2 gap-2">
			{#each metrics.slice(3) as m (m.label)}
				<div class="min-w-0 rounded-xl border border-border/40 bg-card p-2.5 shadow-sm">
					<div class="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg {m.accent}">
						<m.icon class="h-3.5 w-3.5" />
					</div>
					<p class="truncate text-[9px] text-muted-foreground">{m.label}</p>
					<p class="truncate text-xs font-bold tabular-nums">{m.value}</p>
				</div>
			{/each}
		</div>

		<div class="grid gap-2 sm:grid-cols-2">
			<div class="rounded-xl border border-border/40 bg-card p-3">
				<p class="mb-2 text-[10px] font-semibold">Weekly Cashflow</p>
				<div class="flex h-16 items-end gap-1">
					{#each cashflowBars as height, i (i)}
						<div
							class="flex-1 rounded-t-md bg-gradient-to-t from-primary/80 to-primary/30"
							style="height: {height}%"
						></div>
					{/each}
				</div>
			</div>
			<div class="rounded-xl border border-border/40 bg-card p-3">
				<p class="mb-2 text-[10px] font-semibold">Loan Types</p>
				<div class="flex items-center gap-3">
					<div
						class="relative h-14 w-14 rounded-full border-[6px] border-primary border-r-chart-2 border-b-chart-5 border-l-chart-4"
					></div>
					<div class="space-y-1 text-[9px]">
						<p>
							<span class="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary"></span>
							Lot Title 42%
						</p>
						<p>
							<span class="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-chart-2"></span>
							OR/CR 31%
						</p>
						<p>
							<span class="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-chart-5"></span>
							Agent 27%
						</p>
					</div>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-3 gap-2">
			{#each activity as item (item.label)}
				<div class="min-w-0 rounded-xl border border-border/40 bg-muted/30 px-2 py-2 sm:px-3">
					<p class="truncate text-[9px] font-medium text-muted-foreground">{item.label}</p>
					<p class="text-sm font-bold whitespace-nowrap">
						{item.count}
						<span class="text-[10px] font-medium text-muted-foreground">loans</span>
					</p>
				</div>
			{/each}
		</div>
	</div>
</BrowserFrame>
