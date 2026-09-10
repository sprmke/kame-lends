<script lang="ts">
	import type { Snippet } from 'svelte';
	import SearchFilter from '$lib/components/common/SearchFilter.svelte';
	import ViewModeToggle from '$lib/components/common/ViewModeToggle.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Filter, X } from 'lucide-svelte';
	import type { ViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		searchValue: string;
		searchPlaceholder: string;
		onSearchChange: (value: string) => void;
		viewMode?: ViewMode;
		onViewModeChange?: (mode: ViewMode) => void;
		showCalendar?: boolean;
		hasData?: boolean;
		showViewToggle?: boolean;
		hasActiveFilters?: boolean;
		onClearFilters?: () => void;
		filters?: Snippet;
		showMoreFilters?: boolean;
		onToggleMoreFilters?: () => void;
		hasActiveAdvancedFilters?: boolean;
		moreFilters?: Snippet;
		class?: string;
	}

	let {
		searchValue,
		searchPlaceholder,
		onSearchChange,
		viewMode,
		onViewModeChange,
		showCalendar = false,
		hasData = true,
		showViewToggle = false,
		hasActiveFilters = false,
		onClearFilters,
		filters,
		showMoreFilters = false,
		onToggleMoreFilters,
		hasActiveAdvancedFilters = false,
		moreFilters,
		class: className
	}: Props = $props();
</script>

<div class={cn('flex flex-col gap-3', className)}>
<div class="mobile-list-toolbar">
	<SearchFilter
		value={searchValue}
		onChange={onSearchChange}
		placeholder={searchPlaceholder}
		class="min-w-0 flex-1 lg:min-w-[12rem]"
	/>
	<div class="mobile-list-toolbar-controls">
		{#if showViewToggle && viewMode && onViewModeChange && hasData}
			<ViewModeToggle
				{viewMode}
				onViewModeChange={onViewModeChange}
				{showCalendar}
				{hasData}
				class="shrink-0"
			/>
		{/if}
		{#if filters}
			{@render filters()}
		{/if}
		{#if moreFilters && onToggleMoreFilters}
			<Button
				variant={showMoreFilters ? 'secondary' : 'outline'}
				size="sm"
				class="relative shrink-0 px-3 whitespace-nowrap"
				onclick={onToggleMoreFilters}
			>
				<Filter class="h-4 w-4 xl:mr-2" />
				<span class="hidden xl:inline">{showMoreFilters ? 'Less' : 'More'} Filters</span>
				{#if hasActiveAdvancedFilters}
					<span class="relative ml-1 flex h-2 w-2 xl:ml-2">
						<span
							class="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-primary opacity-75"
						></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
					</span>
				{/if}
			</Button>
		{/if}
		{#if hasActiveFilters && onClearFilters}
			<Button variant="outline" size="sm" class="shrink-0" onclick={onClearFilters}>
				<X class="h-4 w-4 xl:mr-2" />
				<span class="hidden xl:inline">Clear All</span>
			</Button>
		{/if}
	</div>
</div>
{#if showMoreFilters && moreFilters}
	<div class="dashboard-filter-panel animate-in duration-200 slide-in-from-top-2">
		{@render moreFilters()}
	</div>
{/if}
</div>
