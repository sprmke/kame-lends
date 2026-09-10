<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';
	import type { TableColumnSkeleton } from './table-columns';
	import SkeletonIdentity from './SkeletonIdentity.svelte';

	interface Props {
		columns: TableColumnSkeleton[];
		rows?: number;
		tallRows?: boolean;
		class?: string;
	}

	let { columns, rows = 8, tallRows = false, class: className }: Props = $props();
</script>

<div class={cn('surface-card overflow-hidden', className)}>
	<div class="flex items-center gap-3 border-b border-border/50 bg-muted/30 px-4 py-3">
		{#each columns as col, i (i)}
			<div class={cn('min-w-0 basis-0', col.grow, col.visibility)}>
				<Skeleton class={cn('h-3', col.headerWidth ?? 'w-3/5')} />
			</div>
		{/each}
	</div>
	{#each Array.from({ length: rows }) as _, rowIndex (rowIndex)}
		<div
			class={cn(
				'flex items-center gap-3 border-b border-border/50 px-4 last:border-0',
				tallRows ? 'py-4' : 'py-3.5'
			)}
		>
			{#each columns as col, i (i)}
				<div class={cn('min-w-0 basis-0', col.grow, col.visibility)}>
					{#if col.identity}
						<SkeletonIdentity size="sm" />
					{:else}
						<Skeleton
							class={cn(
								col.pill ? 'h-6 rounded-full' : (col.cellHeight ?? 'h-4'),
								col.cellWidth ?? 'w-full'
							)}
						/>
					{/if}
				</div>
			{/each}
		</div>
	{/each}
	<div
		class="flex flex-col items-start justify-between gap-3 border-t border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:px-6"
	>
		<Skeleton class="h-4 w-56 max-w-full" />
		<div class="flex items-center gap-2">
			<Skeleton class="h-8 w-24 rounded-xl" />
			<Skeleton class="h-8 w-8 rounded-xl" />
			<Skeleton class="h-8 w-8 rounded-xl" />
			<Skeleton class="h-8 w-16 rounded-xl" />
		</div>
	</div>
</div>
