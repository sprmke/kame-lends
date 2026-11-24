<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';

	const weekCount = 5;
	const dayCount = 7;
</script>

<div class="min-w-0 space-y-3" aria-hidden="true">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<Skeleton class="h-5 w-40 max-w-full" />
		<div class="flex flex-wrap items-center gap-2">
			<div class="pill-segment inline-flex h-11 items-center gap-0.5 p-0.5">
				<Skeleton class="h-10 w-10 rounded-lg" />
				<Skeleton class="h-10 w-10 rounded-lg" />
				<Skeleton class="hidden h-10 w-10 rounded-lg lg:block" />
			</div>
			<Skeleton class="h-11 w-24 rounded-2xl" />
			<Skeleton class="h-11 w-11 rounded-2xl" />
			<Skeleton class="h-11 w-11 rounded-2xl" />
		</div>
	</div>

	<Card.Root class="min-w-0">
		<Card.Content class="min-w-0 overflow-hidden p-0">
			<div class="grid grid-cols-7 border-b border-border/60 bg-muted/20">
				{#each Array.from({ length: dayCount }) as _, index (index)}
					<div class="flex h-10 items-center justify-center px-2">
						<Skeleton class="h-3 w-8" />
					</div>
				{/each}
			</div>
			{#each Array.from({ length: weekCount }) as _, weekIndex (weekIndex)}
				<div class="grid grid-cols-7 border-b border-border/60 last:border-0">
					{#each Array.from({ length: dayCount }) as _, dayIndex (dayIndex)}
						<div class="min-h-24 space-y-2 border-r border-border/40 p-2 last:border-r-0">
							<Skeleton class="h-3 w-5" />
							{#if (weekIndex + dayIndex) % 3 === 0}
								<Skeleton class="h-6 w-full rounded-md" />
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		</Card.Content>
	</Card.Root>
</div>
