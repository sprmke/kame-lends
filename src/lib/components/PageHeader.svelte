<script lang="ts">
	import type { Snippet } from 'svelte';
	import PriceVisibilityToggle from '$lib/components/common/PriceVisibilityToggle.svelte';

	interface Props {
		title: string;
		description?: string;
		eyebrow?: string;
		showPriceToggle?: boolean;
		children?: Snippet;
	}

	let { title, description, eyebrow, showPriceToggle = false, children }: Props = $props();
</script>

<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
	<!-- Title lives in MobileTopBar under lg; keep actions only on phone. -->
	<div class="hidden min-w-0 space-y-0.5 lg:block">
		{#if eyebrow}
			<p class="section-eyebrow">{eyebrow}</p>
		{/if}
		<div class="flex flex-wrap items-center gap-2">
			<h1 class="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
			{#if showPriceToggle}
				<PriceVisibilityToggle />
			{/if}
		</div>
		{#if description}
			<p class="text-sm text-muted-foreground">{description}</p>
		{/if}
	</div>
	{#if children}
		<div class="flex w-full shrink-0 flex-wrap items-center gap-1.5 lg:w-auto lg:justify-end">
			{#if showPriceToggle}
				<div class="lg:hidden">
					<PriceVisibilityToggle />
				</div>
			{/if}
			{@render children()}
		</div>
	{:else if showPriceToggle}
		<div class="lg:hidden">
			<PriceVisibilityToggle />
		</div>
	{/if}
</div>
