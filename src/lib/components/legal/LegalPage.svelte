<script lang="ts">
	import { APP_NAME } from '$lib/brand';

	interface Props {
		title: string;
		summary: string;
		updated?: string;
		children: import('svelte').Snippet;
	}

	let { title, summary, updated = 'November 21, 2026', children }: Props = $props();
</script>

<svelte:head><title>{title} · {APP_NAME}</title></svelte:head>

<main class="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14 lg:px-8">
	<header class="space-y-3 border-b border-border/60 pb-6">
		<p class="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{APP_NAME}</p>
		<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
		<p class="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{summary}</p>
		<p class="text-xs text-muted-foreground">Last updated {updated}</p>
	</header>
	<div class="legal-copy mt-8 space-y-7 text-sm leading-relaxed sm:text-base">
		{@render children()}
	</div>
</main>

<style>
	.legal-copy :global(h2) {
		margin-bottom: 0.5rem;
		font-size: 1.05rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.legal-copy :global(p + p) {
		margin-top: 0.75rem;
	}

	.legal-copy :global(ul) {
		margin-top: 0.5rem;
		padding-left: 1.25rem;
		list-style: disc;
	}

	.legal-copy :global(li + li) {
		margin-top: 0.4rem;
	}

	.legal-copy :global(a) {
		color: var(--primary-strong);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
</style>
