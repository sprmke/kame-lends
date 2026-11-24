<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<Card.Root aria-hidden="true">
	<Card.Content class="space-y-3 p-3">
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array.from({ length: 4 }) as _, index (index)}
				<div class={index === 3 ? 'space-y-1 sm:col-span-2 lg:col-span-1' : 'space-y-1'}>
					<div class="flex items-center gap-2">
						<Skeleton class="h-3 w-3 rounded-sm" />
						<Skeleton class="h-3 w-16" />
					</div>
					<Skeleton class="h-4 w-4/5 max-w-[14rem]" />
				</div>
			{/each}
		</div>
	</Card.Content>
</Card.Root>
