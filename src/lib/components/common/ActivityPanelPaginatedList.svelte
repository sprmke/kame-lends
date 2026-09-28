<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { createIsMobileShell } from '$lib/composables/use-media-query.svelte';

	interface Props {
		items: T[];
		itemKey: (item: T) => string | number;
		/** Items shown per page inside the panel on phone (`<lg`). */
		mobilePageSize?: number;
		row: Snippet<[T]>;
	}

	let { items, itemKey, mobilePageSize = 4, row }: Props = $props();

	const mobileShell = createIsMobileShell(false);
	let page = $state(1);

	$effect(() => {
		mobileShell.init();
	});

	const totalPages = $derived(Math.max(1, Math.ceil(items.length / mobilePageSize)));
	const useMobilePager = $derived(mobileShell.matches && items.length > mobilePageSize);

	const visibleItems = $derived(
		useMobilePager ? items.slice((page - 1) * mobilePageSize, page * mobilePageSize) : items
	);

	const rangeStart = $derived((page - 1) * mobilePageSize + 1);
	const rangeEnd = $derived(Math.min(page * mobilePageSize, items.length));

	$effect(() => {
		if (page > totalPages) page = Math.max(1, totalPages);
	});

	let lastItemCount = $state(items.length);
	$effect(() => {
		if (items.length !== lastItemCount) {
			lastItemCount = items.length;
			page = 1;
		}
	});

	function goPrev() {
		if (page > 1) page -= 1;
	}

	function goNext() {
		if (page < totalPages) page += 1;
	}
</script>

<div class="dashboard-activity-list">
	{#each visibleItems as item (itemKey(item))}
		{@render row(item)}
	{/each}
</div>

{#if useMobilePager}
	<div
		class="mt-2.5 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5"
		role="navigation"
		aria-label="Panel pages"
	>
		<Button
			type="button"
			variant="outline"
			size="icon"
			class="h-10 w-10 shrink-0 rounded-xl"
			disabled={page <= 1}
			onclick={goPrev}
			aria-label="Previous"
		>
			<ChevronLeft class="h-4 w-4" />
		</Button>

		<p class="min-w-0 text-center text-xs font-medium text-muted-foreground tabular-nums" aria-live="polite">
			{rangeStart}–{rangeEnd} of {items.length}
		</p>

		<Button
			type="button"
			variant="outline"
			size="icon"
			class="h-10 w-10 shrink-0 rounded-xl"
			disabled={page >= totalPages}
			onclick={goNext}
			aria-label="Next"
		>
			<ChevronRight class="h-4 w-4" />
		</Button>
	</div>
{/if}
