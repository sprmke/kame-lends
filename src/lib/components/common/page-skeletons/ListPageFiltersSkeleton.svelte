<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	interface Props {
		/** Inline filter triggers (selects) beside the search box. */
		filterCount?: number;
		showSearch?: boolean;
		showViewToggle?: boolean;
		/** Loans show table, cards, calendar and timeline toggles. */
		fullViewToggle?: boolean;
		showMoreFilters?: boolean;
		showClear?: boolean;
		showExport?: boolean;
		showPrimaryAction?: boolean;
		/** Full-width date range above the toolbar on phones. */
		showDateRange?: boolean;
		/** Extra trailing controls (bulk select, export, add). */
		trailingCount?: number;
		class?: string;
	}

	let {
		filterCount = 0,
		showSearch = true,
		showViewToggle = false,
		fullViewToggle = false,
		showMoreFilters = false,
		showClear = false,
		showExport = false,
		showPrimaryAction = false,
		showDateRange = false,
		trailingCount = 0,
		class: className
	}: Props = $props();
</script>

<div class={cn('skeleton-toolbar flex flex-col gap-3', className)}>
	{#if showDateRange}
		<div class="lg:hidden" aria-hidden="true">
			<Skeleton class="h-11 w-full rounded-2xl" />
		</div>
	{/if}

	<div class="mobile-list-toolbar">
		<div class="flex min-w-0 flex-1 basis-[min(100%,14rem)] flex-wrap items-center gap-2">
			{#if showSearch}
				<Skeleton class="h-11 min-w-0 flex-1 rounded-2xl lg:min-w-[12rem]" />
			{/if}
		</div>
		<div class="mobile-list-toolbar-controls">
			{#if showViewToggle}
				<Skeleton
					class={fullViewToggle
						? 'h-11 w-[5.5rem] shrink-0 rounded-2xl lg:w-[10.75rem]'
						: 'h-11 w-11 shrink-0 rounded-2xl lg:w-[5.5rem]'}
				/>
			{/if}
			{#each Array.from({ length: filterCount }) as _, i (i)}
				<Skeleton
					class="h-11 w-[5.75rem] max-w-[34vw] shrink rounded-2xl sm:w-[10rem] xl:w-[11.25rem]"
				/>
			{/each}
			{#if showMoreFilters}
				<Skeleton class="h-11 w-11 shrink-0 rounded-2xl xl:w-[130px]" />
			{/if}
			{#if showClear}
				<Skeleton class="h-11 w-11 shrink-0 rounded-2xl xl:w-[118px]" />
			{/if}
			{#if showExport}
				<Skeleton class="hidden h-11 w-24 shrink-0 rounded-2xl xl:block" />
			{/if}
			{#if showPrimaryAction}
				<Skeleton class="h-11 w-11 shrink-0 rounded-2xl lg:w-28" />
			{/if}
			{#each Array.from({ length: trailingCount }) as _, i (i)}
				<Skeleton class="h-11 w-11 shrink-0 rounded-2xl lg:hidden" />
			{/each}
		</div>
	</div>
</div>
