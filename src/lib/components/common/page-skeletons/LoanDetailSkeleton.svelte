<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';

	interface Props {
		investorSections?: number;
	}

	let { investorSections = 2 }: Props = $props();
</script>

<div aria-busy="true" aria-label="Loading loan details" class="dashboard-stack" role="status">
	<Card.Root>
		<Card.Header class="pb-3">
			<Skeleton class="h-5 w-28" />
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-4">
				{#each Array.from({ length: 8 }) as _, index (index)}
					<div class="dashboard-metric-cell space-y-2">
						<Skeleton class="h-3 w-20" />
						<Skeleton class="h-4 w-28" />
					</div>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header class="pb-3">
			<Skeleton class="h-5 w-24" />
		</Card.Header>
		<Card.Content class="grid gap-3 sm:grid-cols-2">
			{#each Array.from({ length: 4 }) as _, index (index)}
				<div class="space-y-2 rounded-lg border p-3">
					<Skeleton class="h-3 w-16" />
					<Skeleton class="h-4 w-full" />
				</div>
			{/each}
		</Card.Content>
	</Card.Root>

	<div class="space-y-3">
		<Skeleton class="h-6 w-40" />
		<Skeleton class="h-24 w-full rounded-xl" />
	</div>

	{#each Array.from({ length: investorSections }) as _, index (index)}
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between gap-3 pb-3">
				<div class="min-w-0 flex-1 space-y-2">
					<Skeleton class="h-5 w-40" />
					<Skeleton class="h-3 w-56 max-w-full" />
				</div>
				<Skeleton class="h-8 w-8 rounded-md" />
			</Card.Header>
			<Card.Content class="space-y-3">
				{#each Array.from({ length: 2 }) as _, rowIndex (rowIndex)}
					<div class="flex items-center justify-between gap-3 rounded-lg border p-3">
						<div class="space-y-1.5">
							<Skeleton class="h-4 w-28" />
							<Skeleton class="h-3 w-20" />
						</div>
						<Skeleton class="h-5 w-24" />
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	{/each}
</div>
