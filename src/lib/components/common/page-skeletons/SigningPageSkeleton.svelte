<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div
	aria-busy="true"
	aria-label="Loading signing page"
	class="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5 md:space-y-6"
	role="status"
>
	<div class="space-y-2.5">
		<Skeleton class="h-9 w-24 rounded-lg" />
		<div class="flex flex-wrap items-center gap-2">
			<Skeleton class="h-6 w-48 max-w-full" />
			<Skeleton class="h-5 w-16 rounded-full" />
		</div>
		<Skeleton class="h-4 w-full max-w-xl" />
	</div>

	<div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:items-start">
		<Card.Root class="order-1 min-w-0 overflow-hidden rounded-3xl shadow-sm xl:order-1">
			<Card.Header class="space-y-1 p-5 pb-3 sm:p-6 sm:pb-4 md:p-7 md:pb-5">
				<Skeleton class="h-5 w-40" />
			</Card.Header>
			<Card.Content class="p-0">
				<div class="space-y-4 bg-muted/20 p-6 sm:p-8">
					<Skeleton class="h-6 w-2/3" />
					<Skeleton class="h-4 w-full" />
					<Skeleton class="h-4 w-11/12" />
					<Skeleton class="h-4 w-4/5" />
					<Skeleton class="mt-6 h-40 w-full rounded-xl" />
					<Skeleton class="h-4 w-3/4" />
					<Skeleton class="h-4 w-2/3" />
				</div>
			</Card.Content>
		</Card.Root>

		<div class="order-2 min-w-0 space-y-5 xl:sticky xl:top-6 xl:order-2 xl:self-start">
			<Card.Root class="rounded-3xl shadow-sm">
				<Card.Header class="p-5 pb-3 sm:p-6 sm:pb-4">
					<Skeleton class="h-5 w-52 max-w-full" />
				</Card.Header>
				<Card.Content class="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
					<Skeleton class="h-40 w-full rounded-2xl" />
				</Card.Content>
			</Card.Root>

			<Card.Root class="rounded-3xl shadow-sm">
				<Card.Header class="p-5 pb-3 sm:p-6 sm:pb-4">
					<Skeleton class="h-5 w-40 max-w-full" />
				</Card.Header>
				<Card.Content class="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
					<div class="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
						<Skeleton class="mt-1 h-5 w-5 shrink-0 rounded-sm" />
						<div class="min-w-0 flex-1 space-y-2">
							<Skeleton class="h-4 w-full" />
							<Skeleton class="h-4 w-4/5" />
						</div>
					</div>
					<Skeleton class="h-11 w-full rounded-xl" />
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
