<script lang="ts">
	import { ChevronLeft } from 'lucide-svelte';
	import { formatText } from '$lib/format';
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		backLabel?: string;
		onBack?: () => void;
		backHref?: string;
		titleAddon?: Snippet;
		descriptionContent?: Snippet;
		actions?: Snippet;
		class?: string;
		/** When false, hides the back control even if `backHref` or `onBack` is set. */
		showBack?: boolean;
	}

	let {
		title,
		description,
		backLabel = 'Back',
		onBack,
		backHref,
		titleAddon,
		descriptionContent,
		actions,
		class: className = '',
		showBack = true
	}: Props = $props();

	const backClass =
		'native-press -ml-1 inline-flex h-9 items-center gap-0.5 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground';
</script>

<header class={cn('space-y-2.5', !showBack && 'space-y-0', className)}>
	{#if showBack && backHref}
		<a href={backHref} data-sveltekit-preload-data="hover" class={backClass}>
			<ChevronLeft class="size-4 shrink-0" strokeWidth={2} />
			<span>{backLabel}</span>
		</a>
	{:else if showBack && onBack}
		<button type="button" class={backClass} onclick={onBack}>
			<ChevronLeft class="size-4 shrink-0" strokeWidth={2} />
			<span>{backLabel}</span>
		</button>
	{/if}

	<div class="space-y-1">
		<div class="flex min-w-0 flex-wrap items-center gap-2">
			<h1 class="min-w-0 text-lg font-semibold tracking-tight line-clamp-2 lg:text-xl">
				{formatText(title)}
			</h1>
			{#if titleAddon}
				{@render titleAddon()}
			{/if}
		</div>
		{#if descriptionContent}
			<div class="text-sm leading-relaxed text-muted-foreground">
				{@render descriptionContent()}
			</div>
		{:else if description}
			<p class="text-sm leading-relaxed text-muted-foreground">{formatText(description)}</p>
		{/if}
	</div>

	{#if actions}
		<div class="pt-1">
			{@render actions()}
		</div>
	{/if}
</header>
