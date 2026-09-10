<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';

	interface Props {
		actionCount?: number;
	}

	let { actionCount = 4 }: Props = $props();
</script>

<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
	<div class="space-y-0.5">
		<Skeleton class="h-7 w-32 md:h-8" />
		<Skeleton class="hidden h-4 w-48 max-w-full lg:block" />
	</div>
	<div class="hidden flex-wrap items-center gap-1.5 lg:flex">
		{#each Array.from({ length: actionCount }) as _, i (i)}
			<Skeleton class="h-8 w-24 rounded-md" />
		{/each}
	</div>
</div>
