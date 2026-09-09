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
		onItemsPerPageChange
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

	const pageItems = $derived(getPageNumbers(currentPage, totalPages));
	const showFooter = $derived(totalPages > 1 || !!itemsPerPage);
	const resolvedEndIndex = $derived(endIndex > 0 ? endIndex : totalItems);
</script>

{#if showFooter}
	<div
		class="flex flex-col gap-2 border-t px-3 py-2.5 sm:px-4 lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
			{#if totalItems > 0}
				<div class="text-sm text-muted-foreground">
					Showing {startIndex + 1} to {Math.min(resolvedEndIndex, totalItems)} of {totalItems}
					{itemName}
				</div>
			{/if}
			{#if itemsPerPage && itemsPerPageOptions && onItemsPerPageChange}
				<div class="flex items-center gap-2">
					<span class="text-sm text-muted-foreground">Show</span>
					<Select.Root
						type="single"
						value={String(itemsPerPage)}
						onValueChange={(value) => value && onItemsPerPageChange(Number(value))}
					>
						<Select.Trigger class="h-8 w-[70px]">
							{itemsPerPage}
						</Select.Trigger>
						<Select.Content>
							{#each itemsPerPageOptions as option (option)}
								<Select.Item value={String(option)}>{option}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<span class="text-sm text-muted-foreground">per page</span>
				</div>
			{/if}
		</div>

		{#if totalPages > 1}
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={currentPage <= 1}
					onclick={() => onPageChange(currentPage - 1)}
				>
					<ChevronLeft class="h-4 w-4" />
					Previous
				</Button>
				<div class="flex items-center gap-1">
					{#each pageItems as item (item)}
						{#if typeof item === 'number'}
							<Button
								variant={currentPage === item ? 'default' : 'outline'}
								size="sm"
								class="h-8 w-8 p-0"
								onclick={() => onPageChange(item)}
							>
								{item}
							</Button>
						{:else}
							<span class="flex h-8 w-8 items-center justify-center text-muted-foreground">
								<MoreHorizontal class="h-4 w-4" />
							</span>
						{/if}
					{/each}
				</div>
				<Button
					variant="outline"
					size="sm"
					disabled={currentPage >= totalPages}
					onclick={() => onPageChange(currentPage + 1)}
				>
					Next
					<ChevronRight class="h-4 w-4" />
				</Button>
			</div>
		{/if}
	</div>
{/if}
