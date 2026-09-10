<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div aria-hidden="true">
	<div class="space-y-2.5 lg:hidden">
		<Skeleton class="h-9 w-16 rounded-lg" />
		<div class="space-y-1">
			<Skeleton class="h-6 w-48 max-w-full" />
			<Skeleton class="h-4 w-40 max-w-full" />
		</div>
	</div>
	<div class="hidden space-y-4 lg:block">
		<Skeleton class="h-9 w-24 rounded-2xl" />
		<div class="space-y-2">
			<Skeleton class="h-7 w-48 max-w-full" />
			<Skeleton class="h-4 w-56 max-w-full" />
		</div>
	</div>
</div>
