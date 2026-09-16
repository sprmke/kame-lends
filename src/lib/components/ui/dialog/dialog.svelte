<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { releaseStaleBodyScrollLock } from "$lib/composables/body-scroll-lock-release";
	import { provideOverlayLayer } from "$lib/composables/overlay-stack.svelte";

	let {
		open = $bindable(false),
		onOpenChange,
		onOpenChangeComplete,
		...restProps
	}: DialogPrimitive.RootProps & {
		onOpenChangeComplete?: (open: boolean) => void;
	} = $props();

	provideOverlayLayer(() => open);

	const CLOSE_COMPLETE_MS = 320;

	let wasOpen = false;

	$effect(() => {
		const isOpen = open;
		if (!wasOpen && isOpen) {
			onOpenChangeComplete?.(true);
		} else if (wasOpen && !isOpen) {
			const timeoutId = window.setTimeout(() => {
				releaseStaleBodyScrollLock();
				onOpenChangeComplete?.(false);
			}, CLOSE_COMPLETE_MS);
			return () => window.clearTimeout(timeoutId);
		}
		wasOpen = isOpen;
	});

	function handleOpenChange(next: boolean) {
		open = next;
		onOpenChange?.(next);
	}
</script>

<DialogPrimitive.Root bind:open onOpenChange={handleOpenChange} {...restProps} />
