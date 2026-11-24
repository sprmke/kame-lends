<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	export type ListCardSkeletonVariant =
		| 'person'
		| 'investor'
		| 'debt'
		| 'transaction'
		| 'loan'
		| 'group';

	interface Props {
		variant?: ListCardSkeletonVariant;
		class?: string;
	}

	let { variant = 'person', class: className }: Props = $props();

	const titleWidth = $derived(
		variant === 'debt' || variant === 'transaction' || variant === 'loan' ? 'w-1/2' : 'w-3/5'
	);
</script>

{#snippet metricCell(span = false)}
	<div class={cn('dashboard-metric-cell p-2', span && 'col-span-2')}>
		<Skeleton class="mb-1 h-2.5 w-12 max-w-[60%]" />
		<Skeleton class="h-3.5 w-4/5 max-w-full" />
	</div>
{/snippet}

{#snippet badge()}
	<Skeleton class="h-5 w-14 shrink-0 rounded-full" />
{/snippet}

{#snippet titleRow()}
	<div class="flex min-w-0 items-start justify-between gap-2">
		<Skeleton class={cn('h-4', titleWidth)} />
		{#if variant === 'debt'}
			{@render badge()}
		{:else if variant === 'transaction' || variant === 'loan'}
			<div class="flex shrink-0 gap-1">
				{@render badge()}
				{@render badge()}
			</div>
		{/if}
	</div>
{/snippet}

<Card.Root class={cn('flex h-full flex-col overflow-hidden', className)}>
	<Card.Header class={cn('relative pb-0', variant === 'loan' ? 'px-4 pt-4' : 'px-3 pt-3')}>
		<Skeleton class="absolute top-3 right-3 h-11 w-11 rounded-full" />
		<div class="min-w-0 pr-11">
			{#if variant === 'group'}
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0 flex-1 space-y-1">
						<div class="flex min-w-0 items-center gap-2">
							<Skeleton class="size-2.5 shrink-0 rounded-full" />
							<Skeleton class="h-4 w-2/3" />
						</div>
						<Skeleton class="h-3.5 w-4/5 max-w-full" />
					</div>
					<Skeleton class="h-5 w-16 shrink-0 rounded-full" />
				</div>
			{:else}
				<div class={cn(variant === 'investor' && 'mb-1')}>
					{@render titleRow()}
				</div>
				{#if variant === 'investor'}
					<Skeleton class="mb-2 h-3 w-4/5 max-w-full" />
				{/if}
			{/if}
		</div>
	</Card.Header>

	<Card.Content
		class={cn(
			'flex-1',
			variant === 'loan' ? 'space-y-3 px-4 pt-0 pb-3' : 'px-3 pt-0 pb-2.5'
		)}
	>
		{#if variant === 'group'}
			<div class="space-y-3">
				<Skeleton class="h-3.5 w-3/4 max-w-full" />
				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center -space-x-2">
						<Skeleton class="size-6 rounded-full ring-2 ring-card" />
						<Skeleton class="size-6 rounded-full ring-2 ring-card" />
						<Skeleton class="size-6 rounded-full ring-2 ring-card" />
					</div>
					<div class="flex items-center gap-2">
						<Skeleton class="size-4 rounded-sm" />
						<Skeleton class="size-4 rounded-sm" />
					</div>
				</div>
			</div>
		{:else if variant === 'transaction'}
			<div class="grid grid-cols-3 gap-2">
				<div class="rounded-lg bg-muted/50 p-2">
					<Skeleton class="mb-1 h-2.5 w-10" />
					<Skeleton class="h-3.5 w-4/5" />
				</div>
				<div class="rounded-lg bg-muted/50 p-2">
					<Skeleton class="mb-1 h-2.5 w-10" />
					<Skeleton class="h-3.5 w-full" />
				</div>
				<div class="rounded-lg bg-muted/50 p-2">
					<Skeleton class="mb-1 h-2.5 w-10" />
					<Skeleton class="h-3.5 w-4/5" />
				</div>
			</div>
		{:else}
			<div class="space-y-2">
				<div class="grid grid-cols-2 gap-1.5">
					{@render metricCell()}
					{@render metricCell()}
					{#if variant === 'person' || variant === 'debt'}
						{@render metricCell()}
						{@render metricCell()}
					{/if}
					{#if variant === 'person'}
						{@render metricCell(true)}
					{/if}
				</div>
				{#if variant === 'debt'}
					<Skeleton class="h-3 w-2/5" />
				{/if}
			</div>
		{/if}
	</Card.Content>
</Card.Root>
