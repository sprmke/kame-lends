<script lang="ts">
	import type { Snippet } from 'svelte';
	import { createOverlayLayer, useOverlayLayer } from '$lib/composables/overlay-stack.svelte';

	let { children }: { children: Snippet } = $props();

	const inherited = useOverlayLayer();
	let frame = $state<HTMLDivElement | null>(null);
	let detectedOpen = $state(false);

	$effect(() => {
		const el = frame;
		if (!el || inherited) return;
		const sync = () => {
			detectedOpen = el.querySelector('[data-state="open"]') !== null;
		};
		sync();
		const observer = new MutationObserver(sync);
		observer.observe(el, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['data-state']
		});
		return () => observer.disconnect();
	});

	const fallback = inherited ? null : createOverlayLayer(() => detectedOpen);
	const zIndex = $derived(inherited?.zIndex ?? fallback?.zIndex ?? 50);
</script>

<div
	bind:this={frame}
	class="pointer-events-none fixed inset-0 isolate"
	style:z-index={zIndex}
>
	{@render children()}
</div>
