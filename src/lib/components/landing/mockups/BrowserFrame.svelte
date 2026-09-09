<script lang="ts">
	import { APP_NAME, APP_DOMAIN } from '$lib/brand';
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		title?: string;
		class?: string;
		glow?: boolean;
	}

	let { children, title = APP_NAME, class: className, glow = false }: Props = $props();

	function previewUrl(path: string) {
		if (path === APP_NAME) return `${APP_DOMAIN}/`;
		return `${APP_DOMAIN}/${path}`;
	}
</script>

<div
	class={cn(
		'relative overflow-hidden rounded-[1.25rem] border border-border/60 bg-card shadow-[var(--shadow-elevated-lg)]',
		glow &&
			'before:absolute before:inset-0 before:-z-10 before:rounded-[1.35rem] before:bg-gradient-to-br before:from-primary/30 before:via-chart-5/20 before:to-transparent before:blur-2xl',
		className
	)}
>
	<div class="flex items-center gap-2 border-b border-border/50 bg-muted/40 px-4 py-3">
		<div class="flex gap-1.5">
			<span class="h-2.5 w-2.5 rounded-full bg-chart-3/80"></span>
			<span class="h-2.5 w-2.5 rounded-full bg-chart-5/80"></span>
			<span class="h-2.5 w-2.5 rounded-full bg-chart-2/80"></span>
		</div>
		<div
			class="mx-auto flex h-7 max-w-[min(100%,380px)] min-w-0 flex-1 items-center justify-center rounded-lg bg-background/80 px-3 text-[10px] font-medium text-muted-foreground"
		>
			<span class="truncate">{previewUrl(title)}</span>
		</div>
	</div>
	<div class="overflow-hidden bg-background">
		{@render children()}
	</div>
</div>
