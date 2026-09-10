<script lang="ts">
	import type { Snippet } from 'svelte';
	import PriceVisibilityToggle from '$lib/components/common/PriceVisibilityToggle.svelte';
	import RegisterMobileHeroActions from '$lib/components/layout/RegisterMobileHeroActions.svelte';
	import { createIsMobileShell } from '$lib/composables/use-media-query.svelte';

	interface Props {
		title: string;
		description?: string;
		eyebrow?: string;
		showPriceToggle?: boolean;
		children?: Snippet;
	}

	let { title, description, eyebrow, showPriceToggle = false, children }: Props = $props();

	const isMobileShell = createIsMobileShell(false);

	$effect(() => isMobileShell.init());
</script>

<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between lg:gap-4">
	<div class="min-w-0 max-w-2xl space-y-2">
		{#if eyebrow}
			<p class="section-eyebrow">{eyebrow}</p>
		{/if}
		<div class="flex flex-wrap items-center gap-2.5">
			<h1 class="text-xl font-semibold tracking-tight">{title}</h1>
			{#if showPriceToggle}
				<div class="hidden lg:block">
					<PriceVisibilityToggle />
				</div>
			{/if}
		</div>
		{#if description}
			<p class="text-sm leading-relaxed text-muted-foreground">{description}</p>
		{/if}
	</div>
	{#if children}
		<RegisterMobileHeroActions snippet={children} active={isMobileShell.matches} />
		{#if !isMobileShell.matches}
			<div
				class="page-header-actions hidden w-full shrink-0 flex-wrap items-center gap-2 lg:flex lg:w-auto lg:justify-end"
			>
				{@render children()}
			</div>
		{/if}
	{/if}
</div>
