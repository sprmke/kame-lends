<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { X } from 'lucide-svelte';
	import CollapsibleSection from './CollapsibleSection.svelte';

	interface Props {
		showMoreFilters: boolean;
		onToggleMoreFilters: () => void;
		hasActiveFilters: boolean;
		hasActiveAmountFilters?: boolean;
		onClearFilters: () => void;
		children: Snippet;
		moreFiltersContent?: Snippet;
	}

	let {
		showMoreFilters,
		onToggleMoreFilters,
		hasActiveFilters,
		hasActiveAmountFilters = false,
		onClearFilters,
		children,
		moreFiltersContent
	}: Props = $props();
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-col gap-3 sm:flex-row">
		{@render children()}

		{#if hasActiveFilters}
			<Button variant="outline" size="sm" onclick={onClearFilters} class="whitespace-nowrap">
				<X class="mr-2 h-4 w-4" />
				Clear All
			</Button>
		{/if}
	</div>

	{#if moreFiltersContent}
		<CollapsibleSection
			isOpen={showMoreFilters}
			onToggle={onToggleMoreFilters}
			trigger={{
				label: `${showMoreFilters ? 'Less' : 'More'} Filters`,
				showIndicator: hasActiveAmountFilters
			}}
		>
			{@render moreFiltersContent()}
		</CollapsibleSection>
	{/if}
</div>
