<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';

	interface Props {
		showMoreFilters?: boolean;
	}

	let { showMoreFilters = true }: Props = $props();
</script>

<div class="flex flex-col gap-2">
	<div class="flex flex-col gap-2 sm:flex-row">
		<Skeleton class="h-11 min-w-0 flex-1 rounded-2xl" />
		<Skeleton class="hidden h-11 w-[180px] rounded-2xl xl:block" />
		<Skeleton class="hidden h-11 w-[180px] rounded-2xl xl:block" />
		{#if showMoreFilters}
			<Skeleton class="h-11 w-[130px] rounded-2xl" />
		{/if}
	</div>
</div>
