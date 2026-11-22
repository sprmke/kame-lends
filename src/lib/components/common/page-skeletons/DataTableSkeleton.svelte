<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';
	import type { TableColumnSkeleton } from './table-columns';

	interface Props {
		columns: TableColumnSkeleton[];
		rows?: number;
		tallRows?: boolean;
		showHeader?: boolean;
		/** Row actions column on the far right (⋯ menu). */
		showActions?: boolean;
		footer?: 'inside' | 'outside' | 'none';
		class?: string;
	}

	let {
		columns,
		rows = 10,
		tallRows = false,
		showHeader = true,
		showActions = true,
		footer = 'inside',
		class: className
	}: Props = $props();

	const rowClass = $derived(tallRows ? 'min-h-14' : 'min-h-12');
</script>

{#snippet paginationSkeleton()}
	<div
		class="flex flex-col gap-2 border-t border-border/50 bg-card px-2 py-2.5 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:gap-2"
	>
		<div class="flex flex-col gap-2 lg:hidden">
			<div class="flex items-center gap-1 rounded-2xl border border-border/60 bg-card p-1">
				<Skeleton class="h-10 w-10 shrink-0 rounded-xl" />
				<Skeleton class="mx-auto h-4 w-24" />
				<Skeleton class="h-10 w-10 shrink-0 rounded-xl" />
			</div>
			<div class="flex items-center justify-between gap-3 px-0.5">
				<Skeleton class="h-4 w-28" />
				<Skeleton class="h-8 w-16" />
			</div>
		</div>
		<Skeleton class="hidden h-4 w-56 max-w-full lg:block" />
		<div class="hidden items-center gap-1 lg:flex">
			<Skeleton class="h-9 w-24 rounded-xl" />
			<Skeleton class="h-9 w-9 rounded-xl" />
			<Skeleton class="h-9 w-9 rounded-xl" />
			<Skeleton class="h-9 w-9 rounded-xl" />
			<Skeleton class="h-9 w-20 rounded-xl" />
		</div>
	</div>
{/snippet}

<div class={cn('surface-card overflow-hidden', className)} aria-hidden="true">
	{#if showHeader}
		<div class="flex h-10 items-center gap-2 border-b border-border/50 bg-muted/20 px-2">
			{#each columns as col, i (i)}
				<div
					class={cn(
						'min-w-0 basis-0',
						col.grow,
						col.visibility,
						col.align === 'right' && 'flex justify-end'
					)}
				>
					<Skeleton class={cn('h-3', col.headerWidth ?? 'w-3/5')} />
				</div>
			{/each}
			{#if showActions}
				<div class="w-12 shrink-0"></div>
			{/if}
		</div>
	{/if}

	{#each Array.from({ length: rows }) as _, rowIndex (rowIndex)}
		<div
			class={cn(
				'flex items-center gap-2 border-b border-border/50 px-2 last:border-0',
				rowClass
			)}
		>
			{#each columns as col, i (i)}
				<div
					class={cn(
						'min-w-0 basis-0',
						col.grow,
						col.visibility,
						col.align === 'right' && 'flex justify-end'
					)}
				>
					<Skeleton
						class={cn(
							col.pill ? 'h-5 rounded-full' : (col.cellHeight ?? 'h-4'),
							col.cellWidth ?? 'w-full'
						)}
					/>
				</div>
			{/each}
			{#if showActions}
				<div class="flex w-12 shrink-0 justify-end">
					<Skeleton class="h-8 w-8 rounded-lg" />
				</div>
			{/if}
		</div>
	{/each}

	{#if footer === 'inside'}
		{@render paginationSkeleton()}
	{/if}
</div>

{#if footer === 'outside'}
	<div class="surface-card mt-3 overflow-hidden lg:mt-6" aria-hidden="true">
		{@render paginationSkeleton()}
	</div>
{/if}
