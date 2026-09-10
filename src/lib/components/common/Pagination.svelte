<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-svelte';

	interface Props {
		currentPage: number;
		totalPages: number;
		onPageChange: (page: number) => void;
		startIndex?: number;
		endIndex?: number;
		totalItems?: number;
		itemName?: string;
		itemsPerPage?: number;
		itemsPerPageOptions?: number[];
		onItemsPerPageChange?: (itemsPerPage: number) => void;
		embedded?: boolean;
	}

	let {
		currentPage,
		totalPages,
		onPageChange,
		startIndex = 0,
		endIndex = 0,
		totalItems = 0,
		itemName = 'items',
		itemsPerPage,
		itemsPerPageOptions,
		onItemsPerPageChange,
		embedded = false
	}: Props = $props();

	type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

	function getPageNumbers(page: number, pages: number): PageItem[] {
		if (pages <= 7) {
			return Array.from({ length: pages }, (_, i) => i + 1);
		}

		const items: PageItem[] = [1];
		const siblings = 1;
		const rangeStart = Math.max(2, page - siblings);
		const rangeEnd = Math.min(pages - 1, page + siblings);

		if (rangeStart > 2) items.push('ellipsis-start');
		for (let i = rangeStart; i <= rangeEnd; i++) items.push(i);
		if (rangeEnd < pages - 1) items.push('ellipsis-end');
		if (pages > 1) items.push(pages);

		return items;
	}

	const DEFAULT_PAGE_SIZE_OPTIONS = [10, 15, 20, 50];

	const pageItems = $derived(getPageNumbers(currentPage, totalPages));
	const resolvedEndIndex = $derived(endIndex > 0 ? endIndex : totalItems);
	const rangeEnd = $derived(Math.min(resolvedEndIndex, totalItems));
	const resolvedPageSizeOptions = $derived.by(() => {
		if (!itemsPerPage || !onItemsPerPageChange) return undefined;
		const options = itemsPerPageOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;
		if (options.includes(itemsPerPage)) return options;
		return [...options, itemsPerPage].sort((a, b) => a - b);
	});
	const showFooter = $derived(totalItems > 0);
	const showPageSize = $derived(Boolean(itemsPerPage && resolvedPageSizeOptions && onItemsPerPageChange));
	const pageSizeSelectId = $derived(`pagination-page-size-${itemName}`);
</script>

{#if showFooter}
	<nav
		data-slot="pagination"
		aria-label="Pagination"
		class={embedded
			? 'flex flex-col gap-3 border-t border-border/50 bg-card px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:gap-2 lg:py-2.5'
			: 'surface-card flex flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:gap-2 lg:py-2.5'}
	>
		<div class="flex min-w-0 items-center justify-between gap-3 lg:justify-start">
			<p class="min-w-0 truncate text-sm text-muted-foreground tabular-nums">
				<span class="lg:hidden">{startIndex + 1} to {rangeEnd} of {totalItems}</span>
				<span class="hidden lg:inline">
					Showing {startIndex + 1} to {rangeEnd} of {totalItems}
					{itemName}
				</span>
			</p>
			{#if showPageSize && itemsPerPage && resolvedPageSizeOptions && onItemsPerPageChange}
				<div class="flex shrink-0 items-center gap-2">
					<label for={pageSizeSelectId} class="hidden text-sm text-muted-foreground lg:inline">
						Show
					</label>
					<Select.Root
						type="single"
						value={String(itemsPerPage)}
						onValueChange={(value) => value && onItemsPerPageChange(Number(value))}
					>
						<Select.Trigger
							id={pageSizeSelectId}
							size="sm"
							class="pagination-page-size-trigger h-9! w-14! shrink-0 rounded-xl px-2"
							aria-label="Items per page"
						>
							{itemsPerPage}
						</Select.Trigger>
						<Select.Content>
							{#each resolvedPageSizeOptions as option (option)}
								<Select.Item value={String(option)}>{option}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<span class="hidden text-sm text-muted-foreground lg:inline">per page</span>
				</div>
			{/if}
		</div>

		<div class="flex items-center justify-between gap-2 lg:justify-end">
			<Button
				variant="outline"
				size="icon"
				class="pagination-nav-button h-11 w-11 shrink-0 rounded-xl lg:h-9 lg:w-auto lg:px-3"
				disabled={currentPage <= 1 || totalPages <= 1}
				onclick={() => onPageChange(currentPage - 1)}
				aria-label="Previous"
			>
				<ChevronLeft class="h-4 w-4" />
				<span class="hidden lg:inline">Previous</span>
			</Button>

			<p class="text-sm tabular-nums text-muted-foreground lg:hidden" aria-live="polite">
				{currentPage} of {totalPages}
			</p>

			<div class="hidden items-center gap-1 lg:flex">
				{#each pageItems as item (item)}
					{#if typeof item === 'number'}
						<Button
							variant={currentPage === item ? 'default' : 'outline'}
							size="sm"
							class="pagination-page-button h-9 w-9 rounded-xl p-0"
							disabled={totalPages <= 1}
							onclick={() => onPageChange(item)}
							aria-current={currentPage === item ? 'page' : undefined}
							aria-label="Page {item}"
						>
							{item}
						</Button>
					{:else}
						<span class="flex h-9 w-9 items-center justify-center text-muted-foreground">
							<MoreHorizontal class="h-4 w-4" />
						</span>
					{/if}
				{/each}
			</div>

			<Button
				variant="outline"
				size="icon"
				class="pagination-nav-button h-11 w-11 shrink-0 rounded-xl lg:h-9 lg:w-auto lg:px-3"
				disabled={currentPage >= totalPages || totalPages <= 1}
				onclick={() => onPageChange(currentPage + 1)}
				aria-label="Next"
			>
				<span class="hidden lg:inline">Next</span>
				<ChevronRight class="h-4 w-4" />
			</Button>
		</div>
	</nav>
{/if}
