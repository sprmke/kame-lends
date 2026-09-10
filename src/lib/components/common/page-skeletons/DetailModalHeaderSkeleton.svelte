<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="flex items-start justify-between gap-3 md:gap-4" aria-hidden="true">
	<div class="min-w-0 flex-1 space-y-2">
		<Skeleton class="h-5 w-48 max-w-full" />
		<Skeleton class="h-4 w-32 max-w-[70%]" />
	</div>
	<div class="flex shrink-0 items-center gap-1">
		<Skeleton class="h-9 w-9 rounded-2xl" />
		<Skeleton class="h-9 w-9 rounded-2xl" />
	</div>
</div>
