<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	interface Props {
		count?: number;
		rows?: number;
		class?: string;
	}

	let {
		count = 4,
		rows = 3,
		class: className = 'grid w-full gap-2.5 md:grid-cols-2 md:gap-5 2xl:grid-cols-4'
	}: Props = $props();
</script>

<div class={cn(className)} aria-hidden="true">
	{#each Array.from({ length: count }) as _, cardIndex (cardIndex)}
		<Card.Root class="flex h-full flex-col overflow-hidden border-border/60">
			<Card.Header class="space-y-0 pb-2">
				<div class="flex items-center justify-between gap-2">
					<div class="flex min-w-0 items-center gap-2">
						<Skeleton class="h-4 w-24 max-w-[60%]" />
						<Skeleton class="h-4 w-6 rounded-full" />
					</div>
					<Skeleton class="icon-well-xs" />
				</div>
			</Card.Header>
			<Card.Content class="min-w-0 flex-1">
				<div class="space-y-2.5">
					{#each Array.from({ length: rows }) as _, rowIndex (rowIndex)}
						<div class="dashboard-activity-item">
							<div class="flex items-start justify-between gap-2">
								<Skeleton class="h-4 w-[55%]" />
								<Skeleton class="h-5 w-14 shrink-0 rounded-full" />
							</div>
							<div class="flex items-center justify-between gap-2">
								<Skeleton class="h-3 w-20" />
								<Skeleton class="h-3 w-16" />
							</div>
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>
	{/each}
</div>
