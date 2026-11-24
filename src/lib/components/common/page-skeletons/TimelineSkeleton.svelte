<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';

	interface Props {
		months?: number;
		daysPerMonth?: number;
	}

	let { months = 2, daysPerMonth = 3 }: Props = $props();
</script>

<div class="loan-timeline flex w-full min-w-0 flex-col gap-7" aria-hidden="true">
	{#each Array.from({ length: months }) as _, monthIndex (monthIndex)}
		<section class="w-full min-w-0">
			<header class="w-full min-w-0 border-b border-border/60 py-3">
				<div class="grid w-full grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2">
					<div class="flex w-11 items-center justify-center">
						<Skeleton class="size-5 rounded-sm" />
					</div>
					<div
						class="min-w-0 space-y-1 lg:flex lg:items-center lg:justify-between lg:gap-3 lg:space-y-0"
					>
						<Skeleton class="h-4 w-28" />
						<Skeleton class="h-4 w-40 max-w-full" />
					</div>
				</div>
			</header>

			<div class="relative mt-3">
				<div
					class="pointer-events-none absolute top-0 bottom-0 left-[1.375rem] w-px -translate-x-1/2 bg-border/60"
				></div>
				{#each Array.from({ length: daysPerMonth }) as _, dayIndex (dayIndex)}
					<article class="timeline-day flex gap-2 pb-6">
						<div
							class="relative z-10 flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border border-transparent bg-background"
						>
							<Skeleton class="h-3 w-5" />
							<Skeleton class="mt-1 h-2.5 w-4" />
						</div>
						<div class="min-w-0 flex-1 space-y-2">
							<Skeleton class="ml-0.5 h-3.5 w-24" />
							{#each Array.from({ length: dayIndex === 0 ? 2 : 1 }) as _, entryIndex (entryIndex)}
								<div class="space-y-2 rounded-2xl border border-border/60 bg-card px-3 py-2.5">
									<div class="flex items-start justify-between gap-2">
										<Skeleton class="h-4 w-1/2" />
										<Skeleton class="h-4 w-16 shrink-0" />
									</div>
									<Skeleton class="h-5 w-20 rounded-full" />
									<Skeleton class="h-3 w-2/5" />
								</div>
							{/each}
						</div>
					</article>
				{/each}
			</div>
		</section>
	{/each}
</div>
