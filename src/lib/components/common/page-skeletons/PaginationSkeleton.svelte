<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="surface-card overflow-hidden px-2 py-2.5 sm:px-4" aria-hidden="true">
	<div class="flex flex-col gap-2 lg:hidden">
		<div class="flex items-center gap-1 rounded-2xl border border-border/60 bg-card p-1 shadow-sm">
			<Skeleton class="h-10 w-10 shrink-0 rounded-xl" />
			<Skeleton class="mx-auto h-4 w-24" />
			<Skeleton class="h-10 w-10 shrink-0 rounded-xl" />
		</div>
		<div class="flex items-center justify-between gap-3 px-0.5">
			<Skeleton class="h-4 w-28" />
			<Skeleton class="h-8 w-16" />
		</div>
	</div>

	<div class="hidden min-w-0 items-center justify-between gap-3 lg:flex lg:flex-1">
		<Skeleton class="h-4 w-56 max-w-full" />
		<div class="flex shrink-0 items-center gap-2">
			<Skeleton class="h-4 w-10" />
			<Skeleton class="h-9 w-14 rounded-xl" />
			<Skeleton class="h-4 w-16" />
		</div>
	</div>

	<div class="hidden items-center justify-end gap-1 lg:flex">
		<Skeleton class="h-9 w-24 rounded-xl" />
		<Skeleton class="h-9 w-9 rounded-xl" />
		<Skeleton class="h-9 w-9 rounded-xl" />
		<Skeleton class="h-9 w-9 rounded-xl" />
		<Skeleton class="h-9 w-20 rounded-xl" />
	</div>
</div>
