<script lang="ts">
	import { cn } from '$lib/utils';
	import BrowserFrame from './BrowserFrame.svelte';

	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	type EventTone = 'sent' | 'due' | 'interest';

	const cells: Array<{
		day: number;
		muted?: boolean;
		today?: boolean;
		events?: Array<{ label: string; tone: EventTone }>;
	}> = [
		{ day: 25, muted: true },
		{ day: 26, muted: true },
		{ day: 27, muted: true },
		{ day: 28, muted: true },
		{ day: 29, muted: true },
		{ day: 30, muted: true },
		{ day: 1 },
		{ day: 2 },
		{ day: 3, events: [{ label: 'Sent ₱180k', tone: 'sent' }] },
		{ day: 4 },
		{ day: 5, events: [{ label: 'Due ₱95k', tone: 'due' }] },
		{ day: 6 },
		{ day: 7 },
		{ day: 8, today: true, events: [{ label: 'Interest due', tone: 'interest' }] },
		{ day: 9 },
		{ day: 10, events: [{ label: 'Sent ₱250k', tone: 'sent' }] },
		{ day: 11 },
		{ day: 12, events: [{ label: 'Due ₱420k', tone: 'due' }] },
		{ day: 13 },
		{ day: 14 },
		{ day: 15 },
		{ day: 16 },
		{ day: 17 },
		{ day: 18 },
		{ day: 19 },
		{ day: 20 },
		{ day: 21 },
		{ day: 22 },
		{ day: 23 },
		{ day: 24 },
		{ day: 25 },
		{ day: 26 },
		{ day: 27 },
		{ day: 28 }
	];

	const toneClass: Record<EventTone, string> = {
		sent: 'border border-info/25 bg-info/15 text-info',
		due: 'border border-chart-3/25 bg-chart-3/15 text-chart-3',
		interest: 'border border-primary/25 bg-primary/12 text-primary'
	};
</script>

<BrowserFrame title="loans">
	<div class="space-y-3 p-4 sm:p-5">
		<div class="flex items-center justify-between gap-2">
			<div>
				<p class="text-[10px] font-semibold tracking-wider text-primary uppercase">Schedule</p>
				<h3 class="text-sm font-bold text-foreground">Loan Calendar</h3>
				<p class="mt-0.5 text-[10px] text-muted-foreground">
					Sent, due, and interest dates in one view
				</p>
			</div>
			<div class="flex gap-1 rounded-xl bg-muted/60 p-1">
				<span class="rounded-lg bg-card px-2 py-1 text-[9px] font-semibold shadow-sm">Month</span>
				<span class="rounded-lg px-2 py-1 text-[9px] font-medium text-muted-foreground">Week</span>
			</div>
		</div>

		<div class="overflow-hidden rounded-xl border border-border/50">
			<div class="grid grid-cols-7 border-b border-border/40 bg-muted/30">
				{#each dayNames as day (day)}
					<div class="py-1.5 text-center text-[9px] font-semibold text-muted-foreground">
						{day}
					</div>
				{/each}
			</div>
			<div class="grid grid-cols-7">
				{#each cells as cell, index (index)}
					<div
						class={cn(
							'min-h-[3.25rem] border-r border-b border-border/30 p-1 last:border-r-0',
							cell.muted && 'bg-muted/25',
							cell.today && 'bg-primary/8'
						)}
					>
						<span
							class={cn(
								'inline-flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-medium',
								cell.today && 'bg-primary text-primary-foreground',
								cell.muted && !cell.today && 'text-muted-foreground/60'
							)}
						>
							{cell.day}
						</span>
						{#each cell.events ?? [] as event (event.label)}
							<div
								class={cn(
									'mt-0.5 truncate rounded px-1 py-0.5 text-[7px] leading-tight font-medium',
									toneClass[event.tone]
								)}
							>
								{event.label}
							</div>
						{/each}
					</div>
				{/each}
			</div>
		</div>

		<div class="flex flex-wrap gap-3 text-[9px] text-muted-foreground">
			<span class="inline-flex items-center gap-1">
				<span class="bg-info h-2 w-2 rounded-full"></span>
				Disbursement
			</span>
			<span class="inline-flex items-center gap-1">
				<span class="h-2 w-2 rounded-full bg-chart-3"></span>
				Due date
			</span>
			<span class="inline-flex items-center gap-1">
				<span class="h-2 w-2 rounded-full bg-primary"></span>
				Interest due
			</span>
		</div>
	</div>
</BrowserFrame>
