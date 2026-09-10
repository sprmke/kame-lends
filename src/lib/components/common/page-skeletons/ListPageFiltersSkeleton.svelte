<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';

	interface Props {
		showMoreFilters?: boolean;
	}

	let { showMoreFilters = true }: Props = $props();
</script>

<div class="skeleton-toolbar">
	<div class="mobile-list-toolbar">
		<Skeleton class="h-11 min-w-0 flex-1 rounded-2xl lg:min-w-[12rem]" />
		<div class="mobile-list-toolbar-controls">
			<Skeleton class="h-11 w-24 rounded-2xl lg:hidden" />
			<Skeleton class="hidden h-11 w-[180px] rounded-2xl xl:block" />
			<Skeleton class="hidden h-11 w-[180px] rounded-2xl xl:block" />
			{#if showMoreFilters}
				<Skeleton class="h-11 w-11 rounded-2xl xl:w-[130px]" />
			{/if}
		</div>
	</div>
</div>
