<script lang="ts">
	import type { Snippet } from 'svelte';
	import { createOverlayLayer, useOverlayLayer } from '$lib/composables/overlay-stack.svelte';

	let { children }: { children: Snippet } = $props();

	const inherited = useOverlayLayer();
	let frame = $state<HTMLDivElement | null>(null);
	let detectedOpen = $state(false);

	const overlaySlots =
		'[data-slot="dialog-overlay"], [data-slot="sheet-overlay"], [data-slot="alert-dialog-overlay"], [data-slot="dialog-content"], [data-slot="sheet-content"], [data-slot="alert-dialog-content"]';

	$effect(() => {
		const el = frame;
		if (!el || inherited) return;

		const observed = new Set<Element>();

		const isOpenNode = (node: Element) =>
			node.getAttribute('data-state') === 'open' || node.hasAttribute('data-open');

		const sync = () => {
			detectedOpen = Array.from(el.querySelectorAll(overlaySlots)).some(isOpenNode);
		};

		const observer = new MutationObserver(() => {
			attach();
			sync();
		});

		const attach = () => {
			for (const node of el.querySelectorAll(overlaySlots)) {
				if (observed.has(node)) continue;
				observed.add(node);
				observer.observe(node, {
					attributes: true,
					attributeFilter: ['data-state', 'data-open']
				});
			}
		};

		observer.observe(el, { childList: true });
		attach();
		sync();
		return () => observer.disconnect();
	});

	const fallback = inherited ? null : createOverlayLayer(() => detectedOpen);
	const zIndex = $derived(inherited?.zIndex ?? fallback?.zIndex ?? 50);
</script>

<div
	bind:this={frame}
	class="pointer-events-none fixed inset-0"
	style:z-index={zIndex}
>
	{@render children()}
</div>
