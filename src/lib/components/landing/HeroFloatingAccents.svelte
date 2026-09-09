<script lang="ts">
	import { ArrowDownLeft, BellRing } from 'lucide-svelte';
	import { cn } from '$lib/utils';
</script>

<div
	class={cn(
		'pointer-events-none absolute z-30',
		'top-[21%] -right-4 sm:-right-6 md:-right-8',
		'animate-float rotate-2'
	)}
>
	<div
		class="flex items-center gap-2.5 rounded-2xl border border-chart-2/25 bg-card/95 px-3.5 py-2.5 shadow-[var(--shadow-elevated-lg)] backdrop-blur-md"
	>
		<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-chart-2/15">
			<ArrowDownLeft class="h-4 w-4 text-chart-2" />
		</span>
		<div class="min-w-0">
			<p class="text-[10px] font-medium text-muted-foreground">Just collected</p>
			<p class="text-sm font-bold text-chart-2 tabular-nums">+₱12,500</p>
		</div>
	</div>
</div>

<div
	class={cn(
		'pointer-events-none absolute z-30',
		'top-[8%] -right-4 sm:-right-6 md:-right-8',
		'animate-float landing-float-delayed rotate-2'
	)}
>
	<div
		class="flex items-center gap-2.5 rounded-2xl border border-primary/25 bg-card/95 px-3.5 py-2.5 shadow-[var(--shadow-elevated-lg)] backdrop-blur-md"
	>
		<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12">
			<BellRing class="h-4 w-4 text-primary" />
		</span>
		<div class="min-w-0">
			<p class="text-[10px] font-medium text-muted-foreground">Due this week</p>
			<p class="text-sm font-bold text-foreground">3 loans</p>
		</div>
	</div>
</div>
