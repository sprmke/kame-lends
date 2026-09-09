<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import Logo from '$lib/components/Logo.svelte';
	import { ChevronLeft } from 'lucide-svelte';

	interface Props {
		title: string;
		showBack?: boolean;
		backHref?: string;
		showLogo?: boolean;
		actions?: Snippet;
		class?: string;
	}

	let {
		title,
		showBack = false,
		backHref = '..',
		showLogo = false,
		actions,
		class: className = ''
	}: Props = $props();
</script>

<header
	class={cn(
		'fixed inset-x-0 top-0 z-40 border-b border-border/80 bg-card/95 pt-safe backdrop-blur-md lg:hidden',
		className
	)}
	style="padding-left: var(--safe-area-left); padding-right: var(--safe-area-right);"
>
	<div class="flex h-[var(--mobile-top-bar-height)] items-center gap-2 px-2">
		{#if showBack}
			<a
				href={backHref}
				class="touch-target inline-flex items-center justify-center rounded-md text-foreground hover:bg-accent"
				aria-label="Back"
			>
				<ChevronLeft class="h-6 w-6" />
			</a>
		{:else if showLogo}
			<a href="/dashboard" class="flex shrink-0 items-center px-1">
				<Logo size="md" showIcon={true} compactIcon={true} />
			</a>
		{/if}

		<p class="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">{title}</p>

		{#if actions}
			<div class="flex shrink-0 items-center gap-1">
				{@render actions()}
			</div>
		{/if}
	</div>
</header>
