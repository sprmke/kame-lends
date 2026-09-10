<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="space-y-4" aria-hidden="true">
	<div class="flex items-center gap-2">
		<Skeleton class="h-9 w-20 rounded-md lg:hidden" />
		<div class="min-w-0 flex-1 space-y-2">
			<Skeleton class="h-7 w-48 max-w-full md:h-8" />
			<Skeleton class="h-4 w-56 max-w-full" />
		</div>
		<div class="hidden items-center gap-1 lg:flex">
			<Skeleton class="h-9 w-9 rounded-md" />
			<Skeleton class="h-9 w-9 rounded-md" />
		</div>
	</div>
</div>
