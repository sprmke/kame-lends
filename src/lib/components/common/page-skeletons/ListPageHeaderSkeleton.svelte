<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';

	interface Props {
		actionCount?: number;
	}

	let { actionCount = 4 }: Props = $props();
</script>

<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between lg:gap-4">
	<div class="min-w-0 max-w-2xl space-y-2">
		<Skeleton class="h-7 w-36 md:h-8" />
		<Skeleton class="hidden h-4 w-56 max-w-full lg:block" />
	</div>
	{#if actionCount > 0}
		<div class="page-header-actions hidden shrink-0 flex-wrap items-center gap-2 lg:flex">
			{#each Array.from({ length: actionCount }) as _, i (i)}
				<Skeleton class="h-9 w-24 rounded-2xl" />
			{/each}
		</div>
	{/if}
</div>
