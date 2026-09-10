<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="flex items-center gap-3" aria-hidden="true">
	<Skeleton class="h-9 w-20 rounded-2xl lg:hidden" />
	<div class="min-w-0 flex-1 space-y-2">
		<Skeleton class="h-7 w-48 max-w-full md:h-8" />
		<Skeleton class="hidden h-4 w-56 max-w-full lg:block" />
	</div>
	<div class="hidden items-center gap-1 lg:flex">
		<Skeleton class="h-9 w-9 rounded-2xl" />
		<Skeleton class="h-9 w-9 rounded-2xl" />
	</div>
</div>
