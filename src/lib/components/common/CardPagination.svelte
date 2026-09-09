<script lang="ts" generics="T">
	import Pagination from '$lib/components/common/Pagination.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		items: T[];
		itemsPerPage?: number;
		itemsPerPageOptions?: number[];
		children: Snippet<[T[]]>;
		itemName?: string;
		class?: string;
		scrollToTop?: boolean;
	}

	let {
		items,
		itemsPerPage: initialItemsPerPage = 10,
		itemsPerPageOptions = [10, 15, 20, 50],
		children,
		itemName = 'items',
		class: className = '',
		scrollToTop = true
	}: Props = $props();

	let currentPage = $state(1);
	let perPage = $state(initialItemsPerPage);

	const totalPages = $derived(Math.max(1, Math.ceil(items.length / perPage)));
	const startIndex = $derived((currentPage - 1) * perPage);
	const endIndex = $derived(startIndex + perPage);
	const paginatedItems = $derived(items.slice(startIndex, endIndex));

	$effect(() => {
		if (currentPage > totalPages && totalPages > 0) {
			currentPage = 1;
		}
	});

	function handlePageChange(page: number) {
		currentPage = page;
		if (scrollToTop) {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	function handleItemsPerPageChange(next: number) {
		perPage = next;
		currentPage = 1;
		if (scrollToTop) {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}
</script>

{#if items.length > 0}
	<div class={className}>
		{@render children(paginatedItems)}

		{#if items.length > Math.min(...itemsPerPageOptions)}
			<div class="mt-6">
				<Pagination
					{currentPage}
					{totalPages}
					onPageChange={handlePageChange}
					{startIndex}
					{endIndex}
					totalItems={items.length}
					{itemName}
					itemsPerPage={perPage}
					{itemsPerPageOptions}
					onItemsPerPageChange={handleItemsPerPageChange}
				/>
			</div>
		{/if}
	</div>
{/if}
