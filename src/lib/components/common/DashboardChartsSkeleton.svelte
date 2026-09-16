<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { CHART_HEIGHT } from '$lib/components/charts/chart-theme';
	import { SHOW_TRANSACTIONS_UI } from '$lib/feature-flags';
	import { cn } from '$lib/utils';

	interface Props {
		showGroupsColumn?: boolean;
	}

	let { showGroupsColumn = false }: Props = $props();
</script>

{#snippet chartCard(showToggle: boolean)}
	<Card.Root class="surface-card border-border/60">
		<Card.Header class="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
			<Skeleton class="h-4 w-44" />
			{#if showToggle}
				<div class="pill-segment self-start">
					<Skeleton class="h-7 w-12 rounded-md" />
					<Skeleton class="h-7 w-14 rounded-md" />
					<Skeleton class="h-7 w-14 rounded-md" />
				</div>
			{/if}
		</Card.Header>
		<Card.Content>
			<Skeleton class="w-full rounded-2xl" style="height: {CHART_HEIGHT}px" />
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
		{#if SHOW_TRANSACTIONS_UI}
			<div class="mb-5">
				{@render chartCard(true)}
			</div>
		{/if}
		<div class={cn('grid gap-5', showGroupsColumn ? 'lg:grid-cols-2' : 'lg:grid-cols-1')}>
			{#if showGroupsColumn}
				<Card.Root class="flex h-full flex-col overflow-hidden border-border/60">
					<Card.Header class="space-y-0 pb-2">
						<Skeleton class="h-4 w-28" />
						<Skeleton class="mt-2 h-3 w-full max-w-xs" />
					</Card.Header>
					<Card.Content>
						<div class="space-y-2">
							<Skeleton class="h-12 w-full rounded-xl" />
							<Skeleton class="h-12 w-full rounded-xl" />
						</div>
					</Card.Content>
				</Card.Root>
			{/if}
			{@render chartCard(false)}
		</div>
	</section>

	<section class="dashboard-section">
		{@render sectionHeading()}
		<div class="grid gap-5 lg:grid-cols-2">
			{@render chartCard(false)}
			{@render chartCard(false)}
		</div>
	</section>
</div>
