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
		/** Renders on the toolbar row immediately after search (e.g. date range). */
		afterSearch?: Snippet;
		showMoreFilters?: boolean;
		onToggleMoreFilters?: () => void;
		hasActiveAdvancedFilters?: boolean;
		moreFilters?: Snippet;
		/** Extra controls on the toolbar row (e.g. mobile bulk select). */
		toolbarTrailing?: Snippet;
		/** Phone select mode: search + Done only; hide view/filter chrome. */
		selectMode?: boolean;
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
		afterSearch,
		showMoreFilters = false,
		onToggleMoreFilters,
		hasActiveAdvancedFilters = false,
		moreFilters,
		toolbarTrailing,
		selectMode = false,
		class: className
	}: Props = $props();
</script>

<div class={cn('flex flex-col gap-3', className)}>
<div class="mobile-list-toolbar">
	<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
		<SearchFilter
			value={searchValue}
			onChange={onSearchChange}
			placeholder={searchPlaceholder}
			class="min-w-0 flex-1 lg:min-w-[12rem]"
		/>
		{#if afterSearch && !selectMode}
			<div class="min-w-0 shrink-0 max-w-full">
				{@render afterSearch()}
			</div>
		{/if}
	</div>
	<div class="mobile-list-toolbar-controls">
		{#if !selectMode && showViewToggle && viewMode && onViewModeChange && hasData}
			<ViewModeToggle
				{viewMode}
				onViewModeChange={onViewModeChange}
				{showCalendar}
				{hasData}
				class="shrink-0"
			/>
		{/if}
		{#if !selectMode && filters}
			{@render filters()}
		{/if}
		{#if !selectMode && moreFilters && onToggleMoreFilters}
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
		{#if !selectMode && hasActiveFilters && onClearFilters}
			<Button variant="outline" size="sm" class="shrink-0" onclick={onClearFilters}>
				<X class="h-4 w-4 xl:mr-2" />
				<span class="hidden xl:inline">Clear All</span>
			</Button>
		{/if}
		{#if toolbarTrailing}
			{@render toolbarTrailing()}
		{/if}
	</div>
</div>
{#if !selectMode && showMoreFilters && moreFilters}
	<div class="dashboard-filter-panel animate-in duration-200 slide-in-from-top-2">
		{@render moreFilters()}
	</div>
{/if}
</div>
