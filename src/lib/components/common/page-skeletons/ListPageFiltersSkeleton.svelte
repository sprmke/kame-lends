<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';

	interface Props {
		showMoreFilters?: boolean;
	}

	let { showMoreFilters = true }: Props = $props();
</script>

<div class="flex flex-col gap-2">
	<div class="flex flex-col gap-2 sm:flex-row">
		<Skeleton class="h-9 min-w-0 flex-1 rounded-md" />
		<Skeleton class="hidden h-9 w-[180px] rounded-md xl:block" />
		<Skeleton class="hidden h-9 w-[180px] rounded-md xl:block" />
		{#if showMoreFilters}
			<Skeleton class="h-9 w-[130px] rounded-md" />
		{/if}
	</div>
</div>
