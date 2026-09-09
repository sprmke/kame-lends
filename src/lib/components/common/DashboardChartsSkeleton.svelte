<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { CHART_HEIGHT } from '$lib/components/charts/chart-theme';
	import { SHOW_TRANSACTIONS_UI } from '$lib/feature-flags';
	import { cn } from '$lib/utils';
</script>

{#snippet chartCard(showToggle: boolean)}
	<Card.Root class="surface-card border-border/60">
		<Card.Header class="flex flex-row items-center justify-between gap-3 space-y-0 px-3 pt-3 pb-0">
			<Skeleton class="h-4 w-44" />
			{#if showToggle}
				<div class="pill-segment self-start">
					<Skeleton class="h-7 w-12 rounded-md" />
					<Skeleton class="h-7 w-14 rounded-md" />
					<Skeleton class="h-7 w-14 rounded-md" />
				</div>
			{/if}
		</Card.Header>
		<Card.Content class="px-3 pt-1 pb-3">
			<Skeleton class="w-full rounded-md" style="height: {CHART_HEIGHT}px" />
		</Card.Content>
	</Card.Root>
{/snippet}

{#snippet sectionHeading()}
	<div>
		<Skeleton class="h-2.5 w-16" />
		<Skeleton class="mt-1 h-4 w-36" />
	</div>
{/snippet}

<div
	aria-busy="true"
	aria-label="Loading dashboard charts"
	class="space-y-4 md:space-y-5"
	role="status"
>
	<section class="dashboard-section">
		{@render sectionHeading()}
		<div class={cn('grid gap-3', SHOW_TRANSACTIONS_UI ? 'lg:grid-cols-2' : 'lg:grid-cols-1')}>
			{#if SHOW_TRANSACTIONS_UI}
				{@render chartCard(true)}
			{/if}
			{@render chartCard(false)}
		</div>
	</section>

	<section class="dashboard-section">
		{@render sectionHeading()}
		<div class="grid gap-3 lg:grid-cols-2">
			{@render chartCard(false)}
			{@render chartCard(false)}
		</div>
	</section>
</div>
