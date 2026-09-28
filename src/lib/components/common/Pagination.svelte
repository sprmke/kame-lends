<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import { createIsMobileShell } from '$lib/composables/use-media-query.svelte';
	import { ChevronLeft, ChevronRight, Check, MoreHorizontal } from 'lucide-svelte';
	import { cn } from '$lib/utils';

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

	const mobileShell = createIsMobileShell(false);
	let pageSizeSheetOpen = $state(false);

	$effect(() => {
		mobileShell.init();
	});

	function selectPageSize(option: number) {
		onItemsPerPageChange?.(option);
		pageSizeSheetOpen = false;
	}

	const navClass = $derived(
		cn(
			'flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-2 lg:py-2.5',
			embedded
				? 'border-t border-border/50 bg-card px-2 py-2.5 sm:px-4 max-lg:bg-transparent'
				: 'surface-card px-2 py-2.5 sm:px-4 max-lg:border-0 max-lg:bg-muted/25 max-lg:shadow-none'
		)
	);
</script>

{#if showFooter}
	<nav data-slot="pagination" aria-label="Pagination" class={navClass}>
		<!-- Phone / tablet: compact pager -->
		<div class="flex flex-col gap-2 lg:hidden">
			<div
				class="flex items-center gap-1 rounded-2xl border border-border/60 bg-card p-1 shadow-sm"
				role="group"
				aria-label="Page navigation"
			>
				<Button
					variant="ghost"
					size="icon"
					class="pagination-nav-button h-10 w-10 shrink-0 rounded-xl text-foreground"
					disabled={currentPage <= 1 || totalPages <= 1}
					onclick={() => onPageChange(currentPage - 1)}
					aria-label="Previous page"
				>
					<ChevronLeft class="h-5 w-5" />
				</Button>

				<p
					class="min-w-0 flex-1 text-center text-sm font-semibold text-foreground tabular-nums"
					aria-live="polite"
				>
					Page {currentPage} of {totalPages}
				</p>

				<Button
					variant="ghost"
					size="icon"
					class="pagination-nav-button h-10 w-10 shrink-0 rounded-xl text-foreground"
					disabled={currentPage >= totalPages || totalPages <= 1}
					onclick={() => onPageChange(currentPage + 1)}
					aria-label="Next page"
				>
					<ChevronRight class="h-5 w-5" />
				</Button>
			</div>

			<div class="flex items-center justify-between gap-3 px-0.5">
				<p class="text-sm text-muted-foreground tabular-nums">
					{startIndex + 1}–{rangeEnd} of {totalItems}
				</p>
				{#if showPageSize && itemsPerPage && resolvedPageSizeOptions && onItemsPerPageChange}
					<button
						type="button"
						class="native-press min-h-11 shrink-0 rounded-xl px-3 text-sm font-medium text-foreground tabular-nums touch-target"
						onclick={() => (pageSizeSheetOpen = true)}
						aria-label="Change items per page, currently {itemsPerPage}"
					>
						{itemsPerPage} / page
					</button>
				{/if}
			</div>
		</div>

		<!-- Desktop -->
		<div class="hidden min-w-0 items-center justify-between gap-3 lg:flex lg:flex-1">
			<p class="min-w-0 truncate text-sm text-muted-foreground tabular-nums">
				Showing {startIndex + 1} to {rangeEnd} of {totalItems}
				{itemName}
			</p>
			{#if showPageSize && itemsPerPage && resolvedPageSizeOptions && onItemsPerPageChange}
				<div class="flex shrink-0 items-center gap-2">
					<label for={pageSizeSelectId} class="text-sm text-muted-foreground">Show</label>
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
					<span class="text-sm text-muted-foreground">per page</span>
				</div>
			{/if}
		</div>

		<div class="hidden items-center justify-end gap-1 lg:flex">
			<Button
				variant="outline"
				size="sm"
				class="pagination-nav-button h-9 rounded-xl px-3"
				disabled={currentPage <= 1 || totalPages <= 1}
				onclick={() => onPageChange(currentPage - 1)}
				aria-label="Previous page"
			>
				<ChevronLeft class="h-4 w-4" />
				Previous
			</Button>

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

			<Button
				variant="outline"
				size="sm"
				class="pagination-nav-button h-9 rounded-xl px-3"
				disabled={currentPage >= totalPages || totalPages <= 1}
				onclick={() => onPageChange(currentPage + 1)}
				aria-label="Next page"
			>
				Next
				<ChevronRight class="h-4 w-4" />
			</Button>
		</div>
	</nav>

	{#if showPageSize && itemsPerPage && resolvedPageSizeOptions && onItemsPerPageChange}
		<ResponsiveModal
			open={pageSizeSheetOpen && mobileShell.matches}
			onOpenChange={(open) => (pageSizeSheetOpen = open)}
			title="Per page"
			bodyClass="py-2"
		>
			<ul class="flex flex-col gap-1" role="listbox" aria-label="Items per page">
				{#each resolvedPageSizeOptions as option (option)}
					<li>
						<button
							type="button"
							role="option"
							aria-selected={itemsPerPage === option}
							class={cn(
								'native-press flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-medium touch-target',
								itemsPerPage === option
									? 'bg-primary/10 text-foreground'
									: 'text-foreground hover:bg-accent'
							)}
							onclick={() => selectPageSize(option)}
						>
							<span class="tabular-nums">{option}</span>
							{#if itemsPerPage === option}
								<Check class="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		</ResponsiveModal>
	{/if}
{/if}
