<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import DetailHeaderSkeleton from './DetailHeaderSkeleton.svelte';
	import SkeletonField from './SkeletonField.svelte';
	import SkeletonIdentity from './SkeletonIdentity.svelte';

	interface Props {
		investorSections?: number;
	}

	let { investorSections = 2 }: Props = $props();
</script>

<div aria-busy="true" aria-label="Loading loan details" class="dashboard-stack" role="status">
	<DetailHeaderSkeleton />

	<Card.Root>
		<Card.Header class="pb-3">
			<Skeleton class="h-5 w-28" />
		</Card.Header>
		<Card.Content>
			<div class="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
				{#each Array.from({ length: 8 }) as _, index (index)}
					<div class="dashboard-metric-cell">
						<SkeletonField labelWidth="w-20" valueWidth="w-28" />
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
				<div class="rounded-2xl border border-border/50 bg-muted/20 p-3">
					<SkeletonField labelWidth="w-16" valueWidth="w-full" />
				</div>
			{/each}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header class="pb-3">
			<Skeleton class="h-5 w-40" />
		</Card.Header>
		<Card.Content class="space-y-3">
			{#each Array.from({ length: 3 }) as _, index (index)}
				<div class="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/20 p-3">
					<SkeletonIdentity size="sm" />
					<Skeleton class="h-5 w-20 shrink-0 rounded-full" />
				</div>
			{/each}
		</Card.Content>
	</Card.Root>

	{#each Array.from({ length: investorSections }) as _, index (index)}
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between gap-3 pb-3">
				<div class="min-w-0 flex-1 space-y-2">
					<Skeleton class="h-5 w-40" />
					<Skeleton class="h-3 w-56 max-w-full" />
				</div>
				<Skeleton class="h-8 w-8 rounded-2xl" />
			</Card.Header>
			<Card.Content class="space-y-3">
				{#each Array.from({ length: 2 }) as _, rowIndex (rowIndex)}
					<div class="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/20 p-3">
						<SkeletonIdentity size="sm" />
						<Skeleton class="h-5 w-24 shrink-0" />
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	{/each}
</div>
