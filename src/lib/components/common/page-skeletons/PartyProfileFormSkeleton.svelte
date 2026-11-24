<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import SkeletonField from './SkeletonField.svelte';

	interface Props {
		/** Page-level edit renders FormHeader; embedded modal/sheet headers own it. */
		showHeader?: boolean;
	}

	let { showHeader = false }: Props = $props();
</script>

<div aria-busy="true" aria-label="Loading profile" class="space-y-4" role="status">
	{#if showHeader}
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="space-y-1">
				<Skeleton class="h-7 w-48 max-w-full md:h-8" />
				<Skeleton class="h-4 w-36 max-w-full" />
			</div>
			<Skeleton class="h-11 w-24 rounded-2xl" />
		</div>
	{/if}

	<Card.Root>
		<Card.Header>
			<Skeleton class="h-5 w-32" />
		</Card.Header>
		<Card.Content class="space-y-4">
			<SkeletonField control labelWidth="w-20" valueWidth="w-full" />
			<SkeletonField control labelWidth="w-28" valueWidth="w-full" />
			<SkeletonField control labelWidth="w-24" valueWidth="w-full" />
			<SkeletonField control labelWidth="w-16" valueWidth="w-full" />
			<SkeletonField labelWidth="w-12" valueWidth="w-full" />

			<div class="space-y-2">
				<Skeleton class="h-3.5 w-16" />
				<Skeleton class="h-32 w-full rounded-2xl" />
			</div>
			<div class="space-y-2">
				<Skeleton class="h-3.5 w-20" />
				<Skeleton class="h-32 w-full rounded-2xl" />
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between gap-2 space-y-0">
			<Skeleton class="h-5 w-40" />
			<Skeleton class="h-11 w-28 rounded-xl" />
		</Card.Header>
		<Card.Content class="space-y-3">
			<div class="flex flex-col gap-3 rounded-2xl border border-border/50 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
				<div class="min-w-0 flex-1 space-y-1.5">
					<Skeleton class="h-4 w-32 max-w-full" />
					<Skeleton class="h-3 w-40 max-w-full" />
				</div>
				<Skeleton class="h-9 w-20 shrink-0 rounded-xl" />
			</div>
		</Card.Content>
	</Card.Root>
</div>
